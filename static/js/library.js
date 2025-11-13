// Netflix-Style Library Page JavaScript

let booksData = { trending: [], popular: [], new: [], all: [] };

let currentGenreFilter = 'all';
let currentBooks = [];

document.addEventListener('DOMContentLoaded', async function() {
    await initializeLibrary();
    setupSearch();
});

async function initializeLibrary() {
    const api = new LibraryAPI();
    // First paint from server-provided seed if available
    const seed = Array.isArray(window.__INITIAL_BOOKS__) ? window.__INITIAL_BOOKS__ : [];
    if (seed.length) {
        booksData.new = seed.slice(0, 8);
        booksData.trending = seed.slice(0, 8);
        booksData.popular = seed.slice(0, 8);
        booksData.all = seed.slice();
    }
    // Then refresh from API (non-blocking for first paint)
    try {
        const latest = await api.getBooks({ page: 1, limit: 12, search: null });
        const list = (latest && latest.data && latest.data.books) ? latest.data.books : [];
        if (list.length) {
            booksData.new = list.slice(0, 8);
            booksData.trending = list.slice(0, 8);
            booksData.all = list;
        }
        const popularRes = await api.getBooks({ page: 1, limit: 12, search: null });
        const popList = (popularRes && popularRes.data && popularRes.data.books) ? popularRes.data.books : [];
        if (popList.length) {
            booksData.popular = popList.slice(0, 8);
        }
    } catch (e) {
        // keep whatever we have (seed or empty)
    }

    loadBookSection('trendingBooks', booksData.trending);
    loadBookSection('popularBooks', booksData.popular);
    loadBookSection('newBooks', booksData.new);
    loadBookSection('recommendedBooks', booksData.trending.slice(0, 4));

    if (booksData.trending[0]) setFeaturedBook(booksData.trending[0]);
}

function loadBookSection(sectionId, books) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    section.innerHTML = books.map(book => `
        <div class="book-card" onclick="openBookModal(${book.id})">
            <div class="book-cover">
                <i class="fas fa-book"></i>
            </div>
            <div class="book-info">
                <h6 class="book-title">${book.title}</h6>
                <p class="book-author">${book.author}</p>
                <p class="book-rating">⭐ ${book.rating}</p>
                <div class="book-buttons">
                    <button class="btn-small" onclick="event.stopPropagation(); borrowBook()">
                        <i class="fas fa-plus"></i> Borrow
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function setFeaturedBook(book) {
    document.getElementById('featuredTitle').textContent = book.title;
    document.getElementById('featuredAuthor').textContent = `by ${book.author}`;
    document.getElementById('featuredRating').textContent = `⭐ ${book.rating}`;
    document.getElementById('featuredGenre').textContent = book.genre;
    document.getElementById('featuredYear').textContent = book.year;
}

function openBookModal(bookId) {
    // Find book in all data
    let book = null;
    for (const category in booksData) {
        book = booksData[category].find(b => b.id === bookId);
        if (book) break;
    }

    if (!book) return;

    document.getElementById('modalTitle').textContent = book.title;
    document.getElementById('modalAuthor').textContent = `by ${book.author}`;
    document.getElementById('modalRating').textContent = `⭐ ${book.rating}`;
    document.getElementById('modalReviews').textContent = `(${book.reviews} reviews)`;
    document.getElementById('modalDescription').textContent = book.description;
    document.getElementById('modalGenre').textContent = book.genre;
    document.getElementById('modalYear').textContent = book.year;
    document.getElementById('modalPages').textContent = book.pages;
    document.getElementById('modalLanguage').textContent = book.language;

    document.getElementById('bookModal').classList.add('active');
}

function closeModal() {
    document.getElementById('bookModal').classList.remove('active');
}

function borrowBook() {
    const title = document.getElementById('modalTitle').textContent;
    
    // Find the book ID from the modal - we need to track this
    let bookId = null;
    for (const category in booksData) {
        const book = booksData[category].find(b => b.title === title);
        if (book) {
            bookId = book.id;
            break;
        }
    }
    
    if (!bookId) {
        showNotification('Error: Could not find book', 'error');
        return;
    }
    
    // Call API to borrow
    (async () => {
        try {
            const api = new LibraryAPI();
            const res = await api.borrowBook(bookId);
            if (res && res.status === 'success') {
                showNotification(`"${title}" borrowed successfully! Due date: ${new Date(res.data.due_at).toLocaleDateString()}`, 'success');
                closeModal();
                // Refresh the library to update available copies
                initializeLibrary();
            } else {
                showNotification(`Failed to borrow: ${res?.data?.message || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            console.error('Borrow error:', err);
            showNotification(`Error: ${err.message || 'Failed to borrow book'}`, 'error');
        }
    })();
}

function borrowFeaturedBook() {
    const title = document.getElementById('featuredTitle').textContent;
    
    // Find the book ID from featured data
    let bookId = null;
    for (const category in booksData) {
        const book = booksData[category].find(b => b.title === title);
        if (book) {
            bookId = book.id;
            break;
        }
    }
    
    if (!bookId) {
        showNotification('Error: Could not find book', 'error');
        return;
    }
    
    // Call API to borrow
    (async () => {
        try {
            const api = new LibraryAPI();
            const res = await api.borrowBook(bookId);
            if (res && res.status === 'success') {
                showNotification(`"${title}" borrowed successfully! Due date: ${new Date(res.data.due_at).toLocaleDateString()}`, 'success');
                // Refresh the library
                initializeLibrary();
            } else {
                showNotification(`Failed to borrow: ${res?.data?.message || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            console.error('Borrow error:', err);
            showNotification(`Error: ${err.message || 'Failed to borrow book'}`, 'error');
        }
    })();
}

function addToWishlist() {
    const title = document.getElementById('modalTitle').textContent;
    showNotification(`"${title}" added to your wishlist!`, 'success');
}

function filterByGenre(genre) {
    currentGenreFilter = genre;

    // Update active chip
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.classList.add('active');

    showNotification(`Filtered by ${genre === 'all' ? 'all genres' : genre}`, 'info');
}

function sortBooks(sortBy) {
    showNotification(`Sorted by ${sortBy}`, 'info');
}

function filterBooks() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    if (!searchTerm) {
        initializeLibrary();
        return;
    }

    const filteredBooks = (booksData.all || []).filter(book =>
        (book.title || '').toLowerCase().includes(searchTerm) ||
        (book.author || '').toLowerCase().includes(searchTerm)
    );

    if (filteredBooks.length === 0) {
        document.getElementById('trendingBooks').innerHTML = '<p style="color: var(--muted-2); grid-column: 1/-1; text-align: center;">No books found.</p>';
        return;
    }

    document.getElementById('trendingBooks').innerHTML = filteredBooks.map(book => `
        <div class="book-card" onclick="openBookModal(${book.id})">
            <div class="book-cover">
                <i class="fas fa-book"></i>
            </div>
            <div class="book-info">
                <h6 class="book-title">${book.title}</h6>
                <p class="book-author">${book.author}</p>
                <p class="book-rating">⭐ ${book.rating}</p>
                <div class="book-buttons">
                    <button class="btn-small" onclick="event.stopPropagation(); borrowBook()">
                        <i class="fas fa-plus"></i> Borrow
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    const style = document.createElement('style');
    if (!document.getElementById('libraryNotificationStyle')) {
        style.id = 'libraryNotificationStyle';
        style.textContent = `
            .notification {
                position: fixed;
                top: 100px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 10px;
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 208, 0, 0.3);
                z-index: 10000;
                animation: slideIn 0.3s ease;
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 500;
                color: var(--accent);
                background: rgba(255, 208, 0, 0.1);
            }

            .notification-success {
                color: #22c55e;
                background: rgba(34, 197, 94, 0.2);
                border-color: rgba(34, 197, 94, 0.3);
            }

            .notification-info {
                color: #3b82f6;
                background: rgba(59, 130, 246, 0.2);
                border-color: rgba(59, 130, 246, 0.3);
            }

            .notification-error {
                color: #ef4444;
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.3);
            }

            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Close modal on background click
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('bookModal');
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
});