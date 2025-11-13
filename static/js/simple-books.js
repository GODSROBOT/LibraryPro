// Enhanced books loader for Netflix-style interface
// Check if LibraryAPI exists, if not create a mock
window.LibraryAPI = window.LibraryAPI || class {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    async getBooks(params) {
        // Mock data for testing
        return {
            status: 'success',
            data: {
                books: [
                    {
                        id: 1,
                        title: 'The Great Gatsby',
                        author: 'F. Scott Fitzgerald',
                        imgurl: '',
                        rating: 4.5,
                        available_copies: 3,
                        category: 'Fiction',
                        price: 12.99
                    },
                    {
                        id: 2,
                        title: 'To Kill a Mockingbird',
                        author: 'Harper Lee',
                        imgurl: '',
                        rating: 4.8,
                        available_copies: 5,
                        category: 'Fiction',
                        price: 14.99
                    },
                    {
                        id: 3,
                        title: '1984',
                        author: 'George Orwell',
                        imgurl: '',
                        rating: 4.7,
                        available_copies: 2,
                        category: 'Science Fiction',
                        price: 11.99
                    }
                ]
            }
        };
    }
};

const api = new LibraryAPI('/api');

async function loadBooks() {
    try {
        console.log('Loading books...');
        const response = await api.getBooks({ limit: 50 });
        
        if (response.status === 'success') {
            console.log('Books loaded successfully:', response.data.books.length);
            // cache master and last results for client-side features
            window.__allBooks = response.data.books;
            window.__lastBooks = response.data.books;
            // populate categories from server
            try {
                const catsRes = await api.getCategories();
                if (catsRes && catsRes.status === 'success' && catsRes.data && Array.isArray(catsRes.data.categories)) {
                    const chips = document.querySelector('.filter-chips');
                    if (chips) {
                        const cats = ['All', ...catsRes.data.categories];
                        chips.innerHTML = cats.map(c => `<div class="chip">${c}</div>`).join('');
                    }
                }
            } catch (e) {
                console.warn('Failed to load categories, using default chips', e);
            }

            displayBooks(response.data.books);
            setupEventListeners();
            // start rotating featured banner using loaded books
            startFeaturedRotation(response.data.books, 15000);
        } else {
            throw new Error('Failed to load books');
        }
    } catch (error) {
        console.error('Failed to load books:', error);
        document.getElementById('booksGrid').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <h3>Error loading books</h3>
                <p>Please try again later</p>
                <p><small>${error.message}</small></p>
            </div>
        `;
        
        // Load mock data for demonstration
        loadMockData();
    }
}

function loadMockData() {
    const mockBooks = [
        {
            id: 1,
            title: 'The Great Gatsby',
            author: 'F. Scott Fitzgerald',
            imgurl: '',
            rating: 4.5,
            available_copies: 3,
            category: 'Fiction',
            price: 12.99
        },
        {
            id: 2,
            title: 'To Kill a Mockingbird',
            author: 'Harper Lee', 
            imgurl: '',
            rating: 4.8,
            available_copies: 5,
            category: 'Fiction',
            price: 14.99
        },
        {
            id: 3,
            title: '1984',
            author: 'George Orwell',
            imgurl: '',
            rating: 4.7,
            available_copies: 2,
            category: 'Science Fiction',
            price: 11.99
        },
        {
            id: 4,
            title: 'Pride and Prejudice',
            author: 'Jane Austen',
            imgurl: '',
            rating: 4.6,
            available_copies: 4,
            category: 'Romance',
            price: 10.99
        },
        {
            id: 5,
            title: 'The Hobbit',
            author: 'J.R.R. Tolkien',
            imgurl: '',
            rating: 4.9,
            available_copies: 1,
            category: 'Fantasy',
            price: 15.99
        },
        {
            id: 6,
            title: 'Harry Potter',
            author: 'J.K. Rowling',
            imgurl: '',
            rating: 4.8,
            available_copies: 6,
            category: 'Fantasy',
            price: 13.99
        }
    ];
    
    window.__allBooks = mockBooks;
    window.__lastBooks = mockBooks;
    displayBooks(mockBooks);
    setupEventListeners();
    startFeaturedRotation(mockBooks, 15000);
}

function displayBooks(books) {
    const grid = document.getElementById('booksGrid');
    
    if (!grid) {
        console.error('Books grid element not found!');
        return;
    }
    
    if (books.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No books found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }

        // cache current set for client-side search
        window.__lastBooks = books;
        // also remember last displayed subset for sorting/filtering
        window.__lastDisplayed = books;

        grid.innerHTML = books.map(book => {
            const imgsrc = book.imgurl || book.image_url || book.imageUrl || book.image || '';
            return `
            <div class="book-card" data-book-id="${book.id}">
                <div class="book-cover">
                    ${imgsrc ? 
                        `<img src="${imgsrc}" alt="${book.title}" onerror="this.style.display='none'">` : 
                        `<i class="fas fa-book"></i>`
                    }
                </div>
                <div class="book-actions">
                    <button class="action-btn wishlist-btn" title="Add to wishlist">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="action-btn quick-view-btn" title="Quick view">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <div class="book-info">
                    <h4 class="book-title">${book.title}</h4>
                    <p class="book-author">by ${book.author || 'Unknown Author'}</p>
                    <div class="book-rating">
                        <i class="fas fa-star"></i> ${book.rating || '4.0'}
                    </div>
                    <div class="book-buttons">
                        <button class="btn-small borrow-btn">
                            <i class="fas fa-book-open"></i> Borrow
                        </button>
                    </div>
                </div>
                <div class="reading-progress">
                    <div class="progress-bar" style="width: ${Math.random() * 100}%"></div>
                </div>
                ${book.available_copies < 3 ? '<div class="book-badge">Popular</div>' : ''}
            </div>
        `;
        }).join('');
    
    console.log('Displayed', books.length, 'books');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Book card clicks
    document.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.action-btn')) {
                openBookModal(this.dataset.bookId);
            }
        });
    });

    // Wishlist buttons
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.book-card');
            toggleWishlist(card.dataset.bookId);
        });
    });

    // Borrow buttons on cards
    document.querySelectorAll('.borrow-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const card = this.closest('.book-card');
            borrowBook(card.dataset.bookId);
        });
    });

    // Modal close button
    const closeBtn = document.querySelector('.close-btn');
    const modal = document.getElementById('bookModal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeBookModal);
    }
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeBookModal();
        });
        
        // Modal borrow button
        const modalBorrowBtn = modal.querySelector('.btn-borrow');
        if (modalBorrowBtn) {
            modalBorrowBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.__currentBook) {
                    borrowBook(window.__currentBook.id);
                }
            });
        }
        
        // Modal wishlist button
        const modalWishlistBtn = modal.querySelector('.btn-wishlist');
        if (modalWishlistBtn) {
            modalWishlistBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.__currentBook) {
                    toggleWishlist(window.__currentBook.id);
                }
            });
        }
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(searchBooks, 300));
    }
    
    // Category chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', function(e) {
            // toggle active state (only one active at a time for now)
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const category = this.textContent.trim();
            // filter using master list
            const all = window.__allBooks || window.__lastBooks || [];
            if (!all.length || category === 'All') {
                displayBooks(all);
                setupEventListeners();
                return;
            }
            const filtered = all.filter(b => (b.category || '').toLowerCase().includes(category.toLowerCase()));
            displayBooks(filtered);
            setupEventListeners();
        });
    });
    
    // Sort select handler
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const val = this.value;
            const list = (window.__lastDisplayed && window.__lastDisplayed.slice()) || (window.__lastBooks && window.__lastBooks.slice()) || [];
            const sorted = applySort(list, val);
            displayBooks(sorted);
            setupEventListeners();
        });
    }

    console.log('Event listeners setup complete');
}

function openBookModal(bookId) {
    console.log('Opening modal for book:', bookId);
    
    // Find the book in our cache
    const book = window.__lastBooks?.find(b => b.id == bookId);
    if (!book) {
        console.error('Book not found:', bookId);
        return;
    }
    
    // Store current book for later use (borrow, wishlist)
    window.__currentBook = book;
    
    // Populate modal with book data
    const modal = document.getElementById('bookModal');
    if (!modal) return;
    
    // Update book cover
    const bookCover = modal.querySelector('.book-cover-large');
    if (bookCover) {
        const imgsrc = book.image_url || book.imgurl || book.imageUrl || '';
        if (imgsrc) {
            // Remove existing image if any
            const existingImg = bookCover.querySelector('img');
            if (existingImg) {
                existingImg.remove();
            }
            
            const img = document.createElement('img');
            img.src = imgsrc;
            img.alt = book.title;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.onerror = function() { 
                this.remove();
                bookCover.innerHTML = '<i class="fas fa-book"></i>';
            };
            bookCover.innerHTML = '';
            bookCover.appendChild(img);
        } else {
            bookCover.innerHTML = '<i class="fas fa-book"></i>';
        }
    }
    
    // Update book details
    const updateElement = (selector, content) => {
        const el = modal.querySelector(selector);
        if (el) el.textContent = content;
    };
    
    updateElement('h2', book.title || 'Unknown Title');
    updateElement('.book-details > p', `by ${book.author || 'Unknown Author'}`);
    updateElement('.rating-value', book.rating || '4.0');
    updateElement('.reviews', `(${book.reviews || '0'} reviews)`);
    updateElement('.description', book.description || 'No description available');
    
    // Update meta items
    const metaItems = modal.querySelectorAll('.meta-item');
    if (metaItems.length >= 4) {
        metaItems[0].querySelector('strong').textContent = book.category || 'Unknown';
        metaItems[1].querySelector('strong').textContent = book.pages || 'N/A';
        metaItems[2].querySelector('strong').textContent = book.language || 'English';
        metaItems[3].querySelector('strong').textContent = `${book.available_copies || 0} copies`;
    }
    
    // Update button state based on availability
    const borrowBtn = modal.querySelector('.btn-borrow');
    if (borrowBtn) {
        if (book.available_copies <= 0) {
            borrowBtn.disabled = true;
            borrowBtn.innerHTML = '<i class="fas fa-times-circle"></i> Not Available';
        } else {
            borrowBtn.disabled = false;
            borrowBtn.innerHTML = '<i class="fas fa-book-open"></i> Borrow Now';
        }
    }
    
    // Show modal
    modal.classList.add('active');
}

function closeBookModal() {
    console.log('Closing modal');
    const modal = document.getElementById('bookModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function toggleWishlist(bookId) {
    console.log('Toggle wishlist for book:', bookId);
    
    // Find the book in our cache
    const book = window.__lastBooks?.find(b => b.id == bookId) || window.__currentBook;
    const bookTitle = book?.title || 'Book';
    
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to use wishlist', 'error');
        return;
    }
    
    // Toggle wishlist (UI update for now)
    const wishlistBtn = event?.target?.closest('.wishlist-btn') || 
                       document.querySelector(`.book-card[data-book-id="${bookId}"] .wishlist-btn`);
    
    if (wishlistBtn) {
        wishlistBtn.classList.toggle('active');
        const isActive = wishlistBtn.classList.contains('active');
        showNotification(
            isActive ? `"${bookTitle}" added to wishlist` : `"${bookTitle}" removed from wishlist`,
            'success'
        );
    }
}

function borrowBook(bookId) {
    console.log('Borrowing book:', bookId);
    
    // Find the book in our cache to get its details
    const book = window.__lastBooks?.find(b => b.id == bookId) || window.__currentBook;
    const bookTitle = book?.title || 'Book';
    
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to borrow books', 'error');
        // Optionally redirect to login
        setTimeout(() => {
            window.location.href = '/users/login';
        }, 1500);
        return;
    }
    
    // Call API to borrow
    (async () => {
        try {
            // Disable the button to prevent double-clicks
            const btn = event?.target || document.querySelector(`[data-book-id="${bookId}"]`);
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.6';
            }
            
            const res = await api.borrowBook(bookId);
            if (res && res.status === 'success') {
                showNotification(`"${bookTitle}" borrowed successfully! Due date: ${new Date(res.data.due_at).toLocaleDateString()}`, 'success');
                closeBookModal();
                // Refresh the books list to update available_copies
                await loadBooks();
            } else {
                const errorMsg = res?.data?.message || res?.message || 'Unknown error';
                showNotification(`Failed to borrow: ${errorMsg}`, 'error');
            }
            
            // Re-enable the button
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        } catch (err) {
            console.error('Borrow error:', err);
            const errorMsg = err?.message || err?.data?.message || 'Failed to borrow book';
            showNotification(`Error: ${errorMsg}`, 'error');
            
            // Re-enable the button
            const btn = event?.target || document.querySelector(`[data-book-id="${bookId}"]`);
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    })();
}

function searchBooks(event) {
    const query = (event.target.value || '').trim();
    console.log('Searching for:', query);
    if (!query) {
        // empty -> reload default set
        return loadBooks();
    }

    // try server-side search first
    (async () => {
        try {
            const res = await api.getBooks({ search: query, limit: 100 });
            if (res && res.status === 'success' && Array.isArray(res.data.books)) {
                window.__lastBooks = res.data.books;
                displayBooks(res.data.books);
                setupEventListeners();
                return;
            }
            // if API returned array directly
            if (Array.isArray(res)) {
                window.__lastBooks = res;
                displayBooks(res);
                setupEventListeners();
                return;
            }
        } catch (err) {
            console.warn('Server search failed, falling back to client filter', err);
        }

        // Client-side fallback: filter cached books using substring and fuzzy match
        const books = window.__lastBooks || [];
        const q = query.toLowerCase();
        const filtered = books.filter(b => {
            const title = (b.title || '').toLowerCase();
            if (title.includes(q)) return true;
            // fuzzy: allow small typos using levenshtein distance
            const dist = levenshtein(q, title);
            const thresh = Math.max(1, Math.floor(title.length * 0.25));
            return dist <= thresh;
        });
        displayBooks(filtered);
        setupEventListeners();
    })();
}

// Simple Levenshtein distance (iterative, small strings ok)
function applySort(books, sortOpt) {
    if (!Array.isArray(books)) return books;
    const copy = books.slice();
    switch (sortOpt) {
        case 'newest':
            return copy.sort((a,b) => (new Date(b.created_at || b.createdAt || 0)) - (new Date(a.created_at || a.createdAt || 0)));
        case 'rating':
            return copy.sort((a,b) => (parseFloat(b.rating || 0) - parseFloat(a.rating || 0)) || (parseInt(b.reviews || 0) - parseInt(a.reviews || 0)));
        case 'title_az':
            return copy.sort((a,b) => String(a.title || '').localeCompare(String(b.title || '')));
        case 'popular':
        default:
            return copy.sort((a,b) => (parseInt(b.available_copies || b.total_copies || 0) - parseInt(a.available_copies || a.total_copies || 0)) || (parseFloat(b.rating || 0) - parseFloat(a.rating || 0)));
    }
}

function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length; const bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const v0 = new Array(bl + 1).fill(0);
    const v1 = new Array(bl + 1).fill(0);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < bl; j++) {
            const cost = a[i] === b[j] ? 0 : 1;
            v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }
    return v1[bl];
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Featured banner rotation
function startFeaturedRotation(books, intervalMs = 15000) {
    try {
        if (!books || !books.length) return;
        // pick books that have images, fallback to any
        const candidates = books.filter(b => b.image_url || b.imgurl || b.imageUrl || b.image);
        const pool = candidates.length ? candidates : books;

        // clear any existing interval
        if (window.__featuredInterval) {
            clearInterval(window.__featuredInterval);
        }

        let idx = 0;
        const el = document.querySelector('.featured-banner');
        const titleEl = document.getElementById('featuredTitle');
        const subtitleEl = document.getElementById('featuredSubtitle');

        const rotate = () => {
            const book = pool[idx % pool.length];
            idx++;
            const img = book.image_url || book.imgurl || book.imageUrl || book.image || '';
            if (el && img) {
                // set background image and helper class
                el.style.backgroundImage = `linear-gradient(135deg, rgba(26,26,46,0.9), rgba(15,15,25,0.6)), url('${img}')`;
                el.classList.add('custom-bg');
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            } else if (el) {
                el.style.backgroundImage = '';
                el.classList.remove('custom-bg');
            }
            if (titleEl) titleEl.textContent = book.title || 'Discover Your Next Favorite Book';
            if (subtitleEl) subtitleEl.textContent = book.author ? `by ${book.author}` : (book.category || 'Explore great reads');
        };

        // initial rotate
        rotate();
        window.__featuredInterval = setInterval(rotate, intervalMs);
    } catch (err) {
        console.warn('Failed to start featured rotation', err);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    const style = document.createElement('style');
    if (!document.getElementById('booksNotificationStyle')) {
        style.id = 'booksNotificationStyle';
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

// Load books when page opens
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    loadBooks();
});