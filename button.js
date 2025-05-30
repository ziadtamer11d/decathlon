document.addEventListener('DOMContentLoaded', function() {
    const rentButton = document.querySelector('.rent-button');
    const slidingPanel = document.querySelector('.sliding-panel');
    const overlay = document.querySelector('.overlay');
    
    rentButton.addEventListener('click', function() {
        // Add ripple effect
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        this.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            ripple.remove();
        }, 600);

        slidingPanel.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling when panel is open
    });

    overlay.addEventListener('click', function() {
        slidingPanel.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    });
});
