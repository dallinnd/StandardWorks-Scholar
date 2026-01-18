// --- CONFIGURATION ---
const BOOKS_CONFIG = [
    { 
        id: 'ot', name: 'Old Testament', file: 'standard_works.txt',
        books: new Set(["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"])
    },
    { 
        id: 'nt', name: 'New Testament', file: 'standard_works.txt',
        books: new Set(["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"])
    },
    { 
        id: 'bom', name: 'Book of Mormon', file: 'standard_works.txt',
        books: new Set(["1 Nephi", "2 Nephi", "Jacob", "Enos", "Jarom", "Omni", "Words of Mormon", "Mosiah", "Alma", "Helaman", "3 Nephi", "4 Nephi", "Mormon", "Ether", "Moroni"])
    },
    { 
        id: 'dc', name: 'D&C', file: 'standard_works.txt',
        // UPDATED: Added "Doctrine and Covenants" to the list
        books: new Set(["Doctrine and Covenants", "Section", "D&C"])
    },
    { 
        id: 'pgp', name: 'Pearl of GP', file: 'standard_works.txt',
        books: new Set(["Moses", "Abraham", "Joseph Smith—Matthew", "Joseph Smith—History", "Articles of Faith"])
    }
];

// Global State
let allVerses = [];
let uniqueWords = [];
let chapterList = [];
let activeCategories = new Set(BOOKS_CONFIG.map(b => b.id)); 
let legalTextContent = "Standard Works Data.";

// Search State
let currentSearchResults = []; // Stores the full list of matches
let renderedCount = 0;         // Tracks how many are currently shown on screen
const BATCH_SIZE = 50;         // How many to load at a time

// DOM Elements
const input = document.getElementById('search-input');
const sendBtn = document.getElementById('send-btn');
const suggestionsArea = document.getElementById('suggestions-area');
const resultsArea = document.getElementById('results-area');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.querySelector('.modal-content');
const modalText = document.getElementById('modal-text');
const modalRef = document.querySelector('.modal-ref');
const closeBtn = document.querySelector('.close-btn');
const legalLink = document.getElementById('legal-link');
const filtersContainer = document.getElementById('category-filters');
const modalFooter = document.querySelector('.modal-footer') || createModalFooter();
const prevBtn = document.getElementById('prev-chapter-btn');
const nextBtn = document.getElementById('next-chapter-btn');

function createModalFooter() {
    const f = document.createElement('div');
    f.className = 'modal-footer';
    document.querySelector('.modal-content').appendChild(f);
    return f;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    renderFilters();
    await loadAllBooks();
});

function renderFilters() {
    filtersContainer.innerHTML = '';
    BOOKS_CONFIG.forEach(book => {
        const btn = document.createElement('button');
        btn.className = `filter-chip ${activeCategories.has(book.id) ? 'active' : ''}`;
        btn.innerText = book.name;
        btn.onclick = () => toggleCategory(book.id, btn);
        filtersContainer.appendChild(btn);
    });
}

function toggleCategory(id, btnElement) {
    if (activeCategories.has(id)) {
        activeCategories.delete(id);
        btnElement.classList.remove('active');
    } else {
        activeCategories.add(id);
        btnElement.classList.add('active');
    }
    if (input.value.length > 2) performSearch(input.value);
}

function updateStatus(msg) {
    const el = document.querySelector('.placeholder-msg');
    if(el) el.innerText = msg;
}

// --- CORE: Load File & Sort ---
async function loadAllBooks() {
    updateStatus("Loading Library...");
    allVerses = [];
    let tempWords = new Set();
    let tempChapters = new Set();
    const loadedFiles = {}; 

    // Fetch file (Deduped)
    const uniqueFiles = [...new Set(BOOKS_CONFIG.map(b => b.file))];
    await Promise.all(uniqueFiles.map(async (filename) => {
        try {
            const response = await fetch(filename);
            if (response.ok) loadedFiles[filename] = await response.text();
        } catch (e) { console.warn(`Failed to load ${filename}`, e); }
    }));

    // Parse against config
    BOOKS_CONFIG.forEach(config => {
        const text = loadedFiles[config.file];
        if (text) parseBookText(text, config, tempWords, tempChapters);
    });

    uniqueWords = Array.from(tempWords).sort();
    chapterList = Array.from(tempChapters);
    
    if (allVerses.length === 0) updateStatus("Error: standard_works.txt not found.");
    else updateStatus("Ready to search.");
}

function parseBookText(fullText, config, wordSet, chapterSet) {
    const allLines = fullText.split(/\r?\n/);
    const lineRegex = /^((?:[1-4]\s)?[A-Za-z\s]+\d+:\d+)\s+(.*)$/;

    allLines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        const match = cleanLine.match(lineRegex);
        
        if (match) {
            const reference = match[1].trim(); 
            const text = match[2].trim();
            
            // Filter by Book Name
            let shouldInclude = false;
            if (config.books) {
                for (const bookName of config.books) {
                    if (reference.startsWith(bookName + " ")) {
                        shouldInclude = true;
                        break;
                    }
                }
            } else { shouldInclude = true; } 

            if (shouldInclude) {
                const lastColonIndex = reference.lastIndexOf(':');
                const chapterId = reference.substring(0, lastColonIndex).trim();

                allVerses.push({
                    id: allVerses.length, source: config.id,
                    ref: reference, text: text, chapterId: chapterId
                });
                chapterSet.add(chapterId);

                const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g);
                if (words) words.forEach(w => wordSet.add(w));
            }
        }
    });
}

// --- Search & UI ---
input.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    suggestionsArea.innerHTML = '';
    if (val.length < 2) return;
    const matches = uniqueWords.filter(w => w.startsWith(val)).slice(0, 15);
    matches.forEach(word => {
        const pill = document.createElement('div');
        pill.className = 'pill'; pill.innerText = word;
        pill.onclick = () => { input.value = word; suggestionsArea.innerHTML = ''; performSearch(word); };
        suggestionsArea.appendChild(pill);
    });
});
sendBtn.addEventListener('click', () => performSearch(input.value));
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(input.value); });

function performSearch(query) {
    if (!query) return;
    resultsArea.innerHTML = '';
    const q = query.toLowerCase();
    
    // 1. Filter ALL matches
    currentSearchResults = allVerses.filter(v => activeCategories.has(v.source) && v.text.toLowerCase().includes(q));

    if (currentSearchResults.length === 0) { 
        resultsArea.innerHTML = '<div class="placeholder-msg">No matches found.</div>'; 
        return; 
    }

    // 2. Render first batch
    renderedCount = 0;
    renderNextBatch(q);
}

function renderNextBatch(highlightQuery) {
    // Determine range
    const start = renderedCount;
    const end = Math.min(renderedCount + BATCH_SIZE, currentSearchResults.length);
    const batch = currentSearchResults.slice(start, end);

    // Remove existing "Load More" button if it exists
    const existingBtn = document.getElementById('load-more-btn');
    if (existingBtn) existingBtn.remove();

    // Render Items
    batch.forEach(verse => {
        const box = document.createElement('div'); box.className = 'verse-box';
        const snippet = verse.text.replace(new RegExp(`(${highlightQuery})`, 'gi'), '<b style="color:var(--primary);">$1</b>');
        const sourceBadge = BOOKS_CONFIG.find(b => b.id === verse.source).name;

        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="verse-ref">${verse.ref}</span>
                <span style="font-size:0.7rem; color:var(--text-light); border:1px solid var(--border); padding:2px 6px; border-radius:4px;">${sourceBadge}</span>
            </div>
            <div class="verse-snippet">${snippet}</div>`;
        box.onclick = () => openPopup(verse);
        resultsArea.appendChild(box);
    });

    renderedCount = end;

    // Add "Load More" Button if there are more results
    if (renderedCount < currentSearchResults.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.innerText = `Load More (${currentSearchResults.length - renderedCount} remaining)`;
        
        // Styling the button in JS to avoid CSS file edits
        loadMoreBtn.style.cssText = "width:100%; padding:15px; margin-top:10px; background:var(--bg); border:1px solid var(--border); border-radius:12px; color:var(--primary); font-weight:600; cursor:pointer;";
        
        loadMoreBtn.onclick = () => renderNextBatch(highlightQuery);
        resultsArea.appendChild(loadMoreBtn);
    }
}

// --- Popup & Nav ---
let currentChapterIndex = -1;
function openPopup(verseOrTitle, textIfRef) {
    modalOverlay.classList.remove('hidden'); modalFooter.innerHTML = '';
    prevBtn.classList.add('hidden'); nextBtn.classList.add('hidden');
    if (typeof verseOrTitle === 'string') { modalRef.innerText = verseOrTitle; modalText.innerText = textIfRef; return; }

    const verse = verseOrTitle; modalRef.innerText = verse.ref; modalText.innerText = verse.text; modalText.scrollTop = 0;
    const chapterBtn = document.createElement('button'); chapterBtn.className = 'action-btn';
    chapterBtn.innerText = `View Chapter (${verse.chapterId})`; chapterBtn.onclick = () => viewChapter(verse.chapterId);
    modalFooter.appendChild(chapterBtn);
}

function viewChapter(chapterId) {
    currentChapterIndex = chapterList.indexOf(chapterId); if (currentChapterIndex === -1) return;
    loadChapterContent(chapterId);
    prevBtn.classList.remove('hidden'); nextBtn.classList.remove('hidden'); updateNavButtons(); modalFooter.innerHTML = '';
}

function loadChapterContent(chapterId) {
    const chapterVerses = allVerses.filter(v => v.chapterId === chapterId);
    const fullText = chapterVerses.map(v => {
        const parts = v.ref.split(':'); const num = parts.length > 1 ? parts[1].trim() : '';
        return num ? `<b>${num}</b> ${v.text}` : v.text;
    }).join('\n\n');
    modalRef.innerText = chapterId; modalText.innerHTML = fullText; modalText.scrollTop = 0;
}
function updateNavButtons() {
    prevBtn.style.opacity = currentChapterIndex <= 0 ? '0.3' : '1';
    nextBtn.style.opacity = currentChapterIndex >= chapterList.length - 1 ? '0.3' : '1';
}
function navigateChapter(d) {
    const newIdx = currentChapterIndex + d;
    if (newIdx >= 0 && newIdx < chapterList.length) {
        currentChapterIndex = newIdx;
        modalText.style.opacity = 0;
        setTimeout(() => { loadChapterContent(chapterList[newIdx]); updateNavButtons(); modalText.style.opacity = 1; }, 150);
    }
}
prevBtn.onclick = () => navigateChapter(-1); nextBtn.onclick = () => navigateChapter(1);

let ts = 0;
modalContent.addEventListener('touchstart', (e) => ts = e.changedTouches[0].screenX, {passive: true});
modalContent.addEventListener('touchend', (e) => {
    if (nextBtn.classList.contains('hidden')) return;
    const dist = ts - e.changedTouches[0].screenX;
    if (dist > 50) navigateChapter(1); else if (dist < -50) navigateChapter(-1);
}, {passive: true});

if(legalLink) legalLink.onclick = (e) => { e.preventDefault(); openPopup("Legal Disclosure", legalTextContent); };
function closePopup() { modalOverlay.classList.add('hidden'); }
closeBtn.onclick = closePopup;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closePopup(); });
