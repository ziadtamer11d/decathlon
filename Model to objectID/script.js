// Using your exact Algolia configuration
const algoliaDetails = {
    app_id: 'TR53CBEI82',
    api_search_key: "98ef65e220d8d74a2dfac7a67f1dba11",
    index_name: "prod_en",
};

let foundProducts = [];
let algoliaClient = null;
let algoliaIndex = null;
let currentFilters = {};
let facetsData = {};
const FACET_KEYS = ['available', 'brand', 'category', 'category_name', 'genders', 'nature', 'practices'];

// Initialize Algolia client
function initializeAlgolia() {
    algoliaClient = algoliasearch(algoliaDetails.app_id, algoliaDetails.api_search_key);
    algoliaIndex = algoliaClient.initIndex(algoliaDetails.index_name);
}

// Build facet counts locally from hits (distinct model codes per facet value)
function computeFacetsFromHits(hits, facetKeys = FACET_KEYS) {
    const facetValueToModels = {};
    facetKeys.forEach(key => { facetValueToModels[key] = {}; });

    hits.forEach(hit => {
        const modelCode = hit.id_code_model ?? hit.objectID;
        facetKeys.forEach(key => {
            const raw = hit[key];
            if (raw === undefined || raw === null) return;
            const values = Array.isArray(raw) ? raw : [raw];
            values.forEach(v => {
                const val = String(v);
                if (!facetValueToModels[key][val]) {
                    facetValueToModels[key][val] = new Set();
                }
                facetValueToModels[key][val].add(modelCode);
            });
        });
    });

    // Convert sets to counts
    const result = {};
    facetKeys.forEach(key => {
        result[key] = {};
        Object.keys(facetValueToModels[key]).forEach(val => {
            result[key][val] = facetValueToModels[key][val].size;
        });
    });
    return result;
}

// Fetch facets from Algolia (only for entered model codes)
async function fetchFacets() {
    if (!algoliaIndex) {
        initializeAlgolia();
    }

    // Get model codes from textarea
    const modelCodesText = document.getElementById('modelCodes').value.trim();
    if (!modelCodesText) {
        // If no model codes, show empty filters
        facetsData = {};
        renderFilters();
        return;
    }

    // Parse model codes and remove duplicates from input
    const modelCodes = [...new Set(modelCodesText
        .split(/[\n,]/)
        .map(code => code.trim())
        .filter(code => code.length > 0))];

    if (modelCodes.length === 0) {
        facetsData = {};
        renderFilters();
        return;
    }

    try {
        // Build model codes filter
        const modelFilters = modelCodes.map(code => `id_code_model:${code}`).join(' OR ');
        const filters = `(${modelFilters})`;

        // Fetch matching hits (scoped to entered models) and compute facet counts locally
        const searchResult = await algoliaIndex.search('', {
            hitsPerPage: Math.min(1000, modelCodes.length || 100),
            filters: filters,
            analytics: false,
        });

        facetsData = computeFacetsFromHits(searchResult.hits);
        renderFilters();
    } catch (error) {
        console.error('Error fetching facets:', error);
    }
}

// Render filter groups
function renderFilters() {
    const container = document.getElementById('filtersContainer');
    container.innerHTML = '';

    // Define the order and display names for facets
    const facetConfig = {
        'available': 'Available',
        'brand': 'Brand',
        'category': 'Category',
        'category_name': 'Category Name',
        'genders': 'Genders',
        'nature': 'Nature',
        'practices': 'Practices'
    };

    Object.keys(facetConfig).forEach(facetKey => {
        if (facetsData[facetKey]) {
            const facetGroup = createFilterGroup(facetKey, facetConfig[facetKey], facetsData[facetKey]);
            container.appendChild(facetGroup);
        }
    });
}

// Create a filter group
function createFilterGroup(facetKey, title, facetData) {
    const group = document.createElement('div');
    group.className = 'filter-group';
    group.setAttribute('data-facet', facetKey);

    const header = document.createElement('div');
    header.className = 'filter-group-header';
    header.innerHTML = `
        <h4 class="filter-group-title">${title}</h4>
        <button class="filter-group-search" title="Search in ${title}">🔍</button>
    `;

    const options = document.createElement('div');
    options.className = 'filter-options';

    // Sort facets by count (descending) and take first 5
    const sortedFacets = Object.entries(facetData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    sortedFacets.forEach(([value, count]) => {
        const option = createFilterOption(facetKey, value, count);
        options.appendChild(option);
    });

    // Add "Show more" button if there are more than 5 options
    const totalOptions = Object.keys(facetData).length;
    if (totalOptions > 5) {
        const showMoreBtn = document.createElement('button');
        showMoreBtn.className = 'show-more-btn';
        showMoreBtn.innerHTML = `Show more values (${totalOptions - 5}) ▼`;
        showMoreBtn.onclick = () => showMoreOptions(facetKey, facetData, options, showMoreBtn);
        options.appendChild(showMoreBtn);
    }

    group.appendChild(header);
    group.appendChild(options);
    return group;
}

// Create a filter option
function createFilterOption(facetKey, value, count) {
    const option = document.createElement('div');
    option.className = 'filter-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${facetKey}-${value}`;
    checkbox.setAttribute('data-facet', facetKey);
    checkbox.setAttribute('data-value', value);
    checkbox.onchange = handleFilterChange;
    
    // Check if this option is currently selected
    if (currentFilters[facetKey] && currentFilters[facetKey].includes(value)) {
        checkbox.checked = true;
    }

    const label = document.createElement('label');
    label.className = 'filter-option-label';
    label.setAttribute('for', `${facetKey}-${value}`);
    label.textContent = value;

    // Count should reflect how many of the entered model codes match this facet value
    // When facetsData is built using the model-codes filter, Algolia already scopes counts
    // Additionally, if needed, clamp to the number of requested model codes
    const modelCodesText = document.getElementById('modelCodes').value.trim();
    const modelCodes = modelCodesText ? modelCodesText.split(/[\n,]/).map(c => c.trim()).filter(Boolean) : [];
    const effectiveCount = Math.min(count, modelCodes.length || count);

    const countSpan = document.createElement('span');
    countSpan.className = 'filter-option-count';
    countSpan.textContent = effectiveCount.toLocaleString();

    option.appendChild(checkbox);
    option.appendChild(label);
    option.appendChild(countSpan);
    return option;
}

// Show more options for a facet
function showMoreOptions(facetKey, facetData, container, button) {
    const sortedFacets = Object.entries(facetData)
        .sort(([,a], [,b]) => b - a)
        .slice(5); // Get remaining options

    sortedFacets.forEach(([value, count]) => {
        const option = createFilterOption(facetKey, value, count);
        container.insertBefore(option, button);
    });

    button.style.display = 'none';
}

// Handle filter changes
function handleFilterChange(event) {
    const facet = event.target.getAttribute('data-facet');
    const value = event.target.getAttribute('data-value');
    const isChecked = event.target.checked;

    if (!currentFilters[facet]) {
        currentFilters[facet] = [];
    }

    if (isChecked) {
        if (!currentFilters[facet].includes(value)) {
            currentFilters[facet].push(value);
        }
    } else {
        currentFilters[facet] = currentFilters[facet].filter(v => v !== value);
        if (currentFilters[facet].length === 0) {
            delete currentFilters[facet];
        }
    }

    console.log('Current filters:', currentFilters);
    // Apply filters and search for products
    searchWithFilters();
}

// Search facets
function searchFacets(query) {
    const groups = document.querySelectorAll('.filter-group');
    groups.forEach(group => {
        const options = group.querySelectorAll('.filter-option');
        let hasVisibleOptions = false;

        options.forEach(option => {
            const label = option.querySelector('.filter-option-label').textContent.toLowerCase();
            const isVisible = label.includes(query.toLowerCase());
            option.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) hasVisibleOptions = true;
        });

        group.style.display = hasVisibleOptions ? 'block' : 'none';
    });
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('filterSidebar');
    const button = document.querySelector('.collapse-btn');
    
    sidebar.classList.toggle('collapsed');
    button.textContent = sidebar.classList.contains('collapsed') ? '▶' : '▼';
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {};
    
    // Uncheck all checkboxes
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Search without filters
    searchWithFilters();
}

// Search products with current filters (only for entered model codes)
async function searchWithFilters() {
    if (!algoliaIndex) {
        initializeAlgolia();
    }

    // Get model codes from textarea
    const modelCodesText = document.getElementById('modelCodes').value.trim();
    if (!modelCodesText) {
        // If no model codes, show message
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '<div class="status info">Please enter model codes first to see filtered products.</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    // Parse model codes and remove duplicates from input
    const modelCodes = [...new Set(modelCodesText
        .split(/[\n,]/)
        .map(code => code.trim())
        .filter(code => code.length > 0))];

    if (modelCodes.length === 0) {
        return;
    }

    try {
        // Build filter string for Algolia - combine model codes with other filters
        const filterStrings = [];
        
        // Add model codes filter
        const modelFilters = modelCodes.map(code => `id_code_model:${code}`).join(' OR ');
        filterStrings.push(`(${modelFilters})`);
        
        // Add other filters
        Object.keys(currentFilters).forEach(facet => {
            if (currentFilters[facet].length > 0) {
                const facetFilters = currentFilters[facet].map(value => `${facet}:"${value}"`).join(' OR ');
                filterStrings.push(`(${facetFilters})`);
            }
        });

        const filters = filterStrings.join(' AND ');

        console.log('Searching with filters:', filters);

        // Search with filters
        const searchResult = await algoliaIndex.search('', {
            hitsPerPage: 100,
            filters: filters,
            analytics: false,
        });

        // Remove duplicates from search results based on ObjectID
        const uniqueHits = [];
        const seenObjectIDs = new Set();
        
        searchResult.hits.forEach(hit => {
            if (!seenObjectIDs.has(hit.objectID)) {
                uniqueHits.push(hit);
                seenObjectIDs.add(hit.objectID);
            }
        });

        // Update facets with filtered counts (based on returned hits)
        facetsData = computeFacetsFromHits(uniqueHits);
        renderFilters();

        // Display filtered products
        displayFilteredProducts(uniqueHits);

    } catch (error) {
        console.error('Error searching with filters:', error);
    }
}

// Display filtered products in the main area
function displayFilteredProducts(products) {
    const resultsDiv = document.getElementById('results');
    
    if (products.length === 0) {
        resultsDiv.innerHTML = '<div class="status info">No products found with current filters.</div>';
        resultsDiv.style.display = 'block';
        return;
    }

    let html = `
        <div class="status success">✅ Found ${products.length} products</div>
        <div class="product-grid">
    `;
    
    products.forEach((product, index) => {
        // Get image URL
        const imageUrl = getProductImageUrl(product);
        
        html += `
            <div class="product-card" data-product-index="${index}" ondragover="handleDragOver(event)" ondrop="handleDrop(event)">
                <button class="remove-btn" onclick="removeProduct(${index})" title="Remove product"></button>
                <div class="product-image-container" draggable="true" ondragstart="handleDragStart(event)" ondragend="handleDragEnd(event)">
                    <div class="product-number">${index + 1}</div>
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${product.product_name || 'Product'}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                         <div class="product-image-placeholder" style="display:none;">No Image</div>` :
                        '<div class="product-image-placeholder">No Image</div>'
                    }
                </div>
                <div class="product-info">
                    <div class="product-name">${product.product_name || product.name || 'Unknown Product'}</div>
                    <div class="product-ids">
                        <span class="product-objectid">${product.objectID}</span>
                        <span class="product-model">${product.id_code_model || 'N/A'}</span>
                    </div>
                    <div class="product-price">
                        ${getPriceDisplay(product)}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';

    // Update foundProducts array for copy functions
    foundProducts = products;
    document.getElementById('copyBtn').disabled = foundProducts.length === 0;
    document.getElementById('arrayBtn').disabled = foundProducts.length === 0;
}

// Initialize filters when page loads
document.addEventListener('DOMContentLoaded', function() {
    fetchFacets();
});

// Add event listener to textarea to update filters when model codes change
document.addEventListener('DOMContentLoaded', function() {
    const modelCodesTextarea = document.getElementById('modelCodes');
    if (modelCodesTextarea) {
        modelCodesTextarea.addEventListener('input', function() {
            // Debounce the search to avoid too many API calls
            clearTimeout(window.modelCodeTimeout);
            window.modelCodeTimeout = setTimeout(() => {
                fetchFacets();
                searchWithFilters();
            }, 500);
        });
    }
});

async function convertToObjectIDs() {
    const modelCodesText = document.getElementById('modelCodes').value.trim();
    const convertBtn = document.getElementById('convertBtn');
    const resultsDiv = document.getElementById('results');

    if (!modelCodesText) {
        alert('Please enter model codes');
        return;
    }

    // Parse model codes and remove duplicates from input
    const modelCodes = [...new Set(modelCodesText
        .split(/[\n,]/)
        .map(code => code.trim())
        .filter(code => code.length > 0))];

    if (modelCodes.length === 0) {
        alert('No valid model codes found');
        return;
    }

    // Show loading state
    convertBtn.disabled = true;
    convertBtn.textContent = '🔄 Converting...';
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="status info">Initializing Algolia search...</div>';

    try {
        const clientAlg = algoliasearch(algoliaDetails.app_id, algoliaDetails.api_search_key);
        const indexAlg = clientAlg.initIndex(algoliaDetails.index_name);

        foundProducts = [];
        const notFoundCodes = [];
        const processedObjectIDs = new Set(); // Track processed ObjectIDs to prevent duplicates
        let resultHTML = '';

        for (let i = 0; i < modelCodes.length; i++) {
            const modelCode = modelCodes[i];
            
            // Update progress
            resultsDiv.innerHTML = `<div class="status info">Searching... ${i + 1}/${modelCodes.length} (Model: ${modelCode})</div>`;
            
            try {
                // Search using id_code_model field as shown in your screenshot
                const searchResult = await indexAlg.search('', {
                    filters: `id_code_model:${modelCode}`,
                    hitsPerPage: 1,
                    analytics: false,
                });

                if (searchResult.hits && searchResult.hits.length > 0) {
                    const hit = searchResult.hits[0];
                    
                    // Check if this ObjectID was already processed (prevent duplicates)
                    if (!processedObjectIDs.has(hit.objectID)) {
                        foundProducts.push(hit);
                        processedObjectIDs.add(hit.objectID);
                        resultHTML += `✅ ${modelCode} → ${hit.objectID} (${hit.product_name || hit.name || 'Unknown'})\n`;
                    } else {
                        resultHTML += `⚠️ ${modelCode} → ${hit.objectID} (Duplicate - already found)\n`;
                    }
                } else {
                    notFoundCodes.push(modelCode);
                    resultHTML += `❌ ${modelCode} → Not Found\n`;
                }
            } catch (error) {
                console.error(`Error searching for model ${modelCode}:`, error);
                notFoundCodes.push(modelCode);
                resultHTML += `❌ ${modelCode} → Error: ${error.message}\n`;
            }
        }

        // Store original not found codes to preserve them during updates
        originalNotFoundCodes = [...notFoundCodes];
        
        // Display final results
        displayResults(modelCodes, foundProducts, notFoundCodes, resultHTML);

        document.getElementById('copyBtn').disabled = foundProducts.length === 0;
        document.getElementById('arrayBtn').disabled = foundProducts.length === 0;

    } catch (error) {
        console.error('Algolia error:', error);
        resultsDiv.innerHTML = `<div class="status error">❌ Error: ${error.message}</div>`;
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 Convert to ObjectIDs';
    }
}

function displayResults(requestedCodes, foundProducts, notFoundCodes, resultHTML) {
    const resultsDiv = document.getElementById('results');
    const foundObjectIDs = foundProducts.map(p => p.objectID);

    let html = `
        <div class="status success">✅ Conversion Complete!</div>
        <div class="status info">Found: ${foundProducts.length} | Not Found: ${notFoundCodes.length} | Total: ${requestedCodes.length}</div>
    `;

    if (foundProducts.length > 0) {
        html += '<h3>✅ Found Products & ObjectIDs:</h3>';
        html += '<div class="product-grid">';
        
        foundProducts.forEach((product, index) => {
            // Get image URL
            const imageUrl = getProductImageUrl(product);
            
            html += `
                <div class="product-card" data-product-index="${index}" ondragover="handleDragOver(event)" ondrop="handleDrop(event)">
                    <button class="remove-btn" onclick="removeProduct(${index})" title="Remove product"></button>
                    <div class="product-image-container" draggable="true" ondragstart="handleDragStart(event)" ondragend="handleDragEnd(event)">
                        <div class="product-number">${index + 1}</div>
                        ${imageUrl ? 
                            `<img src="${imageUrl}" alt="${product.product_name || 'Product'}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                             <div class="product-image-placeholder" style="display:none;">No Image</div>` :
                            '<div class="product-image-placeholder">No Image</div>'
                        }
                    </div>
                    <div class="product-info">
                        <div class="product-name">${product.product_name || product.name || 'Unknown Product'}</div>
                        <div class="product-ids">
                            <span class="product-objectid">${product.objectID}</span>
                            <span class="product-model">${product.id_code_model}</span>
                        </div>
                        <div class="product-price">
                            ${getPriceDisplay(product)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }

    if (notFoundCodes.length > 0) {
        html += '<h3>❌ Model Codes Not Found:</h3>';
        html += '<pre>' + notFoundCodes.join('\n') + '</pre>';
    }

    resultsDiv.innerHTML = html;
}

// Store the original not found codes to preserve them during updates
let originalNotFoundCodes = [];

// Function to get product image URL
function getProductImageUrl(product) {
    // Try different possible image fields from Algolia
    if (product.image_urls && product.image_urls.length > 0) {
        return updateImageUrl(product.image_urls[0]);
    }
    if (product.image_url) {
        return updateImageUrl(product.image_url);
    }
    if (product.images && product.images.length > 0) {
        return updateImageUrl(product.images[0]);
    }
    if (product.thumbnail) {
        return updateImageUrl(product.thumbnail);
    }
    // Check for nested image objects
    if (product.image && typeof product.image === 'object') {
        if (product.image.url) return updateImageUrl(product.image.url);
        if (product.image.src) return updateImageUrl(product.image.src);
    }
    // Direct image field
    if (product.image && typeof product.image === 'string') {
        return updateImageUrl(product.image);
    }
    return null;
}

// Use the existing updateImageUrl function for image optimization
function updateImageUrl(url) {
    if (!url) return null;
    const newParams = "format=auto&quality=60&f=300x300";
    if (url.indexOf("?") > -1) {
        const urlParts = url.split("?");
        return `${urlParts[0]}?${newParams}`;
    } else {
        return `${url}?${newParams}`;
    }
}

// Function to get price display with discount styling
function getPriceDisplay(product) {
    const currency = product.currency || 'EGP';
    const currentPrice = product.prix;  // Current/sale price
    const originalPrice = product.regular;  // Original price before discount
    
    // If no price information available
    if (!currentPrice && !originalPrice) {
        return '<span class="price-regular">Price N/A</span>';
    }

    // Check if product is discounted (has both current and original price, and current < original)
    const isDiscounted = currentPrice && originalPrice && (currentPrice < originalPrice);

    if (isDiscounted) {
        // Discounted - red background for current price
        const discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        let priceHtml = `<span class="price-discounted">${currency}${currentPrice}</span>`;
        priceHtml += `<span class="price-crossed">${currency}${originalPrice}</span>`;
        priceHtml += ` <span style="color: #e60023; font-size: 8px; font-weight: bold;">-${discountPercent}%</span>`;
        return priceHtml;
    } else {
        // Regular price - yellow background (use current price or original if no current)
        const displayPrice = currentPrice || originalPrice;
        return `<span class="price-regular">${currency}${displayPrice}</span>`;
    }
}

function copyObjectIDs() {
    if (foundProducts.length === 0) {
        alert('No ObjectIDs to copy');
        return;
    }

    const objectIDs = foundProducts.map(p => p.objectID);
    const textToCopy = objectIDs.join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert(`✅ Copied ${objectIDs.length} ObjectIDs to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`✅ Copied ${objectIDs.length} ObjectIDs to clipboard!`);
    });
}

function copyAsArray() {
    if (foundProducts.length === 0) {
        alert('No ObjectIDs to copy');
        return;
    }

    const objectIDs = foundProducts.map(p => `'${p.objectID}'`);
    const arrayString = `[${objectIDs.join(', ')}]`;
    
    navigator.clipboard.writeText(arrayString).then(() => {
        alert('✅ JavaScript array copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = arrayString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ JavaScript array copied to clipboard!');
    });
}

function clearAll() {
    document.getElementById('modelCodes').value = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('copyBtn').disabled = true;
    document.getElementById('arrayBtn').disabled = true;
    foundProducts = [];
    originalNotFoundCodes = [];
}

// Drag and Drop functionality
let draggedElement = null;
let draggedIndex = null;

function handleDragStart(event) {
    draggedElement = event.target.closest('.product-card');
    draggedIndex = parseInt(draggedElement.dataset.productIndex);
    
    // Add mobile-like visual feedback
    setTimeout(() => {
        if (draggedElement) {
            draggedElement.classList.add('dragging');
            document.querySelector('.product-grid').classList.add('drag-active');
        }
    }, 50);
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedIndex);
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const targetCard = event.target.closest('.product-card');
    if (targetCard && targetCard !== draggedElement) {
        // Remove drag-over from all cards
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('drag-over');
        });
        
        // Add drag-over to current target with animation
        targetCard.classList.add('drag-over');
    }
}

function handleDrop(event) {
    event.preventDefault();
    const targetCard = event.target.closest('.product-card');
    
    if (targetCard && targetCard !== draggedElement) {
        const targetIndex = parseInt(targetCard.dataset.productIndex);
        
        // Add drop animation
        targetCard.style.transform = 'scale(1.1)';
        setTimeout(() => {
            targetCard.style.transform = '';
        }, 200);
        
        // Reorder the foundProducts array
        const draggedProduct = foundProducts[draggedIndex];
        foundProducts.splice(draggedIndex, 1);
        foundProducts.splice(targetIndex, 0, draggedProduct);
        
        // Update the display with animation
        setTimeout(() => {
            updateProductDisplay();
        }, 100);
    }
    
    // Clean up drag styling
    cleanupDragState();
}

function handleDragEnd(event) {
    setTimeout(cleanupDragState, 100);
}

function cleanupDragState() {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    document.querySelectorAll('.product-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    document.querySelector('.product-grid')?.classList.remove('drag-active');
    draggedElement = null;
    draggedIndex = null;
}

// Remove product functionality
function removeProduct(index) {
    foundProducts.splice(index, 1);
    updateProductDisplay();
}

// Helper function to remove duplicates from foundProducts array
function deduplicateFoundProducts() {
    const uniqueProducts = [];
    const seenObjectIDs = new Set();
    
    foundProducts.forEach(product => {
        if (!seenObjectIDs.has(product.objectID)) {
            uniqueProducts.push(product);
            seenObjectIDs.add(product.objectID);
        }
    });
    
    foundProducts = uniqueProducts;
}

// Update product display after reordering or removing
function updateProductDisplay() {
    // Ensure no duplicates before displaying
    deduplicateFoundProducts();
    
    const foundObjectIDs = foundProducts.map(p => p.objectID);
    const requestedCodes = foundProducts.map(p => p.id_code_model);
    let resultHTML = '';
    
    foundProducts.forEach((product, index) => {
        resultHTML += `✅ ${product.id_code_model} → ${product.objectID} (${product.product_name || product.name || 'Unknown'})\n`;
    });
    
    // Use original not found codes to preserve them during updates
    displayResults(requestedCodes, foundProducts, originalNotFoundCodes, resultHTML);
    
    // Update copy buttons
    document.getElementById('copyBtn').disabled = foundProducts.length === 0;
    document.getElementById('arrayBtn').disabled = foundProducts.length === 0;
}
