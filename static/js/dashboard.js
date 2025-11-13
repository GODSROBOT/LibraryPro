// Dashboard helper: load user stats and current borrowings
(async function(){
  function setText(id, v){ const el=document.getElementById(id); if(el) el.textContent = v; }

  async function loadStats(){
    try{
      const api = new LibraryAPI();
      const stats = await api.getUserStats();
      if(stats && stats.status === 'success' && stats.data){
        setText('booksBorrowed', stats.data.total_borrowed ?? 0);
        setText('booksReturned', stats.data.total_returned ?? 0);
        setText('readingStreak', stats.data.reading_streak ?? 0);
        setText('userRating', stats.data.user_rating ?? '4.8');
      }
    }catch(e){ console.warn('Failed to load dashboard stats', e); }
  }

  async function loadCurrentBorrowings(){
    try{
      const api = new LibraryAPI();
      const uid = api.userId || localStorage.getItem('userId');
      if(!uid) return; // not logged in
      const res = await api.getUserBorrowings(uid);
      const container = document.getElementById('currentlyBorrowedList');
      if(!container) return;
      container.innerHTML = '';
      if(res && res.status === 'success' && Array.isArray(res.data.borrowings)){
        if(res.data.borrowings.length === 0){
          container.innerHTML = '<div class="reading-item"><div class="book-cover"><i class="fas fa-book"></i></div><div class="reading-info"><h6>No active borrows</h6><p>Borrow a book to get started</p></div></div>';
          return;
        }
        res.data.borrowings.slice(0,6).forEach(b =>{
          const item = document.createElement('div'); item.className='reading-item';
          const cover = document.createElement('div'); cover.className='book-cover';
          if(b.image_url){ const img=document.createElement('img'); img.src=b.image_url; img.alt=b.title; img.onerror=function(){this.style.display='none'}; cover.appendChild(img);} else { cover.innerHTML='<i class="fas fa-book"></i>'; }
          const info = document.createElement('div'); info.className='reading-info';
          const title = document.createElement('h6'); title.textContent = b.title || 'Untitled';
          const author = document.createElement('p'); author.textContent = b.author || '';
          const small = document.createElement('small');
          small.textContent = b.due_at ? ('Due: ' + new Date(b.due_at).toLocaleDateString()) : '';
          info.appendChild(title); info.appendChild(author); info.appendChild(small);
          item.appendChild(cover); item.appendChild(info);
          container.appendChild(item);
        });
      }
    }catch(e){ console.warn('Failed to load current borrowings', e); }
  }

  // wire edit profile nav
  document.addEventListener('DOMContentLoaded', function(){
    const profileLink = document.querySelector('a[href="/users/profile"]');
    if(profileLink) profileLink.addEventListener('click', function(){ /* allow normal navigation */ });
    loadStats(); loadCurrentBorrowings();
  });
})();