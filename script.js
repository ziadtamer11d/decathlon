// Function to fetch product data
async function fetchProductData() {
    try {
        // Using a CORS proxy to access the Decathlon website
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        const targetUrl = encodeURIComponent('https://www.decathlon.eg/en/p/313348-133634-electric-scooter-r900e.html');
        
        const response = await fetch(proxyUrl + targetUrl);
        const data = await response.json();
        
        // Parse the HTML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        // Extract price information
        updatePriceInfo(doc);
    } catch (error) {
        console.error('Error fetching product data:', error);
    }
}

// Function to update price information
function updatePriceInfo(doc) {
    try {
        // Update current price, original price, and discount
        const currentPrice = document.querySelector('.current-price');
        const originalPrice = document.querySelector('.original-price');
        const discountBadge = document.querySelector('.discount-badge');

        // Extract and update prices from the fetched data
        if (currentPrice && originalPrice && discountBadge) {
            // You might need to adjust these selectors based on Decathlon's HTML structure
            const newCurrentPrice = doc.querySelector('[data-price]')?.getAttribute('data-price');
            const newOriginalPrice = doc.querySelector('[data-regular-price]')?.getAttribute('data-regular-price');
            
            if (newCurrentPrice) {
                currentPrice.textContent = `EGP${newCurrentPrice}`;
            }
            if (newOriginalPrice) {
                originalPrice.textContent = `EGP${newOriginalPrice}`;
                
                // Calculate and update discount percentage
                const discount = Math.round((1 - (parseFloat(newCurrentPrice) / parseFloat(newOriginalPrice))) * 100);
                discountBadge.textContent = `-${discount}%`;
            }
        }
    } catch (error) {
        console.error('Error updating price information:', error);
    }
}

let currentSlide = 0;
const totalSlides = 4;

function updateCarousel() {
    const carousel = document.querySelector('.carousel');
    const dots = document.querySelectorAll('.dot');
    
    // Update carousel position
    carousel.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    // Update dots
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateCarousel();
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateCarousel();
}

function goToSlide(slideIndex) {
    currentSlide = slideIndex;
    updateCarousel();
}

function viewProduct() {
    window.open('https://www.decathlon.eg/en/p/313348-133634-electric-scooter-r900e.html', '_blank');
}

function openModal() {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');
    
    // Initialize or reload the Brightcove player
    const player = videojs('brightcove-player');
    if (player) {
        player.play();
    }
}

function closeModal() {
    const modal = document.getElementById('videoModal');
    modal.classList.remove('active');
    
    // Pause the video when closing the modal
    const player = videojs('brightcove-player');
    if (player) {
        player.pause();
    }
}

// Example of how to update product information dynamically
function updateProductInfo(name, description, imageUrl) {
    document.querySelector('.product-name').textContent = name;
    document.querySelector('.product-description').textContent = description;
    document.querySelector('.product-image').src = imageUrl;
    document.querySelector('.product-image').alt = name;
}

// Add touch support for mobile devices
let touchStartX = 0;
let touchEndX = 0;

document.querySelector('.carousel').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
});

document.querySelector('.carousel').addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const swipeLength = touchEndX - touchStartX;
    
    if (Math.abs(swipeLength) > swipeThreshold) {
        if (swipeLength > 0) {
            prevSlide();
        } else {
            nextSlide();
        }
    }
}

// Fetch product data when the page loads
document.addEventListener('DOMContentLoaded', fetchProductData);

// Refresh price data every 5 minutes
setInterval(fetchProductData, 300000); 
