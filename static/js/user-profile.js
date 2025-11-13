// User Profile - Inline Editing
(function() {
    'use strict';

    let api;
    let currentProfile = {};

    // Initialize API
    function initAPI() {
        if (typeof LibraryAPI === 'undefined') {
            console.error('LibraryAPI not found. Make sure library-api.js is loaded first.');
            return false;
        }
        api = new LibraryAPI('/api');
        return true;
    }

    // Load user profile
    async function loadProfile() {
        try {
            const response = await api.getProfile();
            currentProfile = response.data || response;
            
            // Update header
            document.getElementById('userName').textContent = currentProfile.name || 'User';
            document.getElementById('profileName').textContent = currentProfile.name || 'User';
            document.getElementById('profileEmail').textContent = currentProfile.email || '';
            
            // Update personal information
            document.getElementById('detailName').textContent = currentProfile.name || '—';
            document.getElementById('detailEmail').textContent = currentProfile.email || '—';
            document.getElementById('detailPhone').textContent = currentProfile.phone || '—';
            document.getElementById('detailAddress').textContent = currentProfile.address || '—';
            
            // Hide location section (fields not in database yet)
            const locationCard = document.getElementById('locationViewMode')?.closest('.detail-card');
            if (locationCard) {
                locationCard.style.display = 'none';
            }
            
            console.log('✅ Profile loaded successfully');
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }

    // Toggle Personal Info Edit Mode
    window.toggleEditPersonal = function() {
        const viewMode = document.getElementById('personalViewMode');
        const editMode = document.getElementById('personalEditMode');
        const editBtn = document.getElementById('editPersonalBtn');
        
        if (editMode.style.display === 'none') {
            // Switch to edit mode
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editBtn.innerHTML = '<i class="fas fa-times"></i>';
            editBtn.title = 'Cancel editing';
            
            // Populate edit fields with current values
            document.getElementById('editName').value = currentProfile.name || '';
            document.getElementById('editPhone').value = currentProfile.phone || '';
            document.getElementById('editAddress').value = currentProfile.address || '';
        } else {
            // Switch back to view mode
            cancelEditPersonal();
        }
    };

    // Cancel Personal Info Edit
    window.cancelEditPersonal = function() {
        const viewMode = document.getElementById('personalViewMode');
        const editMode = document.getElementById('personalEditMode');
        const editBtn = document.getElementById('editPersonalBtn');
        
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit personal info';
    };

    // Save Personal Info
    window.savePersonalInfo = async function() {
        const name = document.getElementById('editName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const address = document.getElementById('editAddress').value.trim();
        
        if (!name) {
            showNotification('Name is required', 'error');
            return;
        }
        
        try {
            const payload = { name, phone, address };
            const response = await api.updateProfile(payload);
            
            if (response.status === 'success') {
                showNotification('Profile updated successfully!', 'success');
                
                // Update current profile
                currentProfile.name = name;
                currentProfile.phone = phone;
                currentProfile.address = address;
                
                // Update display
                document.getElementById('userName').textContent = name;
                document.getElementById('profileName').textContent = name;
                document.getElementById('detailName').textContent = name;
                document.getElementById('detailPhone').textContent = phone || '—';
                document.getElementById('detailAddress').textContent = address || '—';
                
                // Switch back to view mode
                cancelEditPersonal();
            }
        } catch (error) {
            showNotification(error.message || 'Failed to update profile', 'error');
        }
    };

    // Toggle Location Edit Mode
    window.toggleEditLocation = function() {
        const viewMode = document.getElementById('locationViewMode');
        const editMode = document.getElementById('locationEditMode');
        const editBtn = document.getElementById('editLocationBtn');
        
        if (editMode.style.display === 'none') {
            // Switch to edit mode
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editBtn.innerHTML = '<i class="fas fa-times"></i>';
            editBtn.title = 'Cancel editing';
            
            // Populate edit fields with current values
            document.getElementById('editCountry').value = currentProfile.country || '';
            document.getElementById('editState').value = currentProfile.state || '';
            document.getElementById('editCity').value = currentProfile.city || '';
            document.getElementById('editPostal').value = currentProfile.postal_code || '';
        } else {
            // Switch back to view mode
            cancelEditLocation();
        }
    };

    // Cancel Location Edit
    window.cancelEditLocation = function() {
        const viewMode = document.getElementById('locationViewMode');
        const editMode = document.getElementById('locationEditMode');
        const editBtn = document.getElementById('editLocationBtn');
        
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit location';
    };

    // Save Location Info
    window.saveLocationInfo = async function() {
        const country = document.getElementById('editCountry').value.trim();
        const state = document.getElementById('editState').value.trim();
        const city = document.getElementById('editCity').value.trim();
        const postal = document.getElementById('editPostal').value.trim();
        
        try {
            const payload = { country, state, city, postal_code: postal };
            const response = await api.updateProfile(payload);
            
            if (response.status === 'success') {
                showNotification('Location updated successfully!', 'success');
                
                // Update current profile
                currentProfile.country = country;
                currentProfile.state = state;
                currentProfile.city = city;
                currentProfile.postal_code = postal;
                
                // Update display
                document.getElementById('detailCountry').textContent = country || '—';
                document.getElementById('detailState').textContent = state || '—';
                document.getElementById('detailCity').textContent = city || '—';
                document.getElementById('detailPostal').textContent = postal || '—';
                
                // Switch back to view mode
                cancelEditLocation();
            }
        } catch (error) {
            showNotification(error.message || 'Failed to update location', 'error');
        }
    };

    // Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
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
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Logout function
    window.performLogout = async function() {
        try {
            if (api) {
                await api.logout();
            }
            localStorage.clear();
            window.location.href = '/auth/login';
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.clear();
            window.location.href = '/auth/login';
        }
    };

    // Initialize profile
    async function initProfile() {
        if (!initAPI()) {
            console.error('Failed to initialize API');
            return;
        }

        // Check if user is logged in
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/auth/login';
            return;
        }

        // Load profile data
        await loadProfile();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProfile);
    } else {
        initProfile();
    }
})();
