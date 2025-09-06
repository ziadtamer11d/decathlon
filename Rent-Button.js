// Rent button functionality
document.addEventListener('DOMContentLoaded', function() {
    const rentButton = document.querySelector('.rent-button');
    const slidePanel = document.getElementById('slidePanel');
    const closeBtn = document.getElementById('closeBtn');
    
    rentButton.addEventListener('click', function() {
        slidePanel.classList.add('active');
        rentButton.classList.add('hidden');
    });
    
    // Close panel with X button
    closeBtn.addEventListener('click', function() {
        slidePanel.classList.remove('active');
        rentButton.classList.remove('hidden');
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', function(event) {
        if (!rentButton.contains(event.target) && !slidePanel.contains(event.target)) {
            slidePanel.classList.remove('active');
            rentButton.classList.remove('hidden');
        }
    });
});
