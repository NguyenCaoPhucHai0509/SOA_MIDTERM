// script.js
let menuItems = [];
let tables = [];
let orderItems = [];
let isBasketOpen = true;
let selectedTableId = null; // Track the selected table
let recentMessages = [];

const orders_url = "http://localhost:8000/orders/";
const menu_url = "http://localhost:8000/menu/";
const table_url = "http://localhost:8000/tables/";

// Fetch data on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchMenu();
    fetchTables();
    switchTab('create-order'); // Set default tab
});

function fetchMenu() {
    const token = localStorage.getItem('access_token');
    fetch(menu_url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html'; // Redirect to expired page
            throw new Error('Unauthorized');
        }
        return response.json();
    })
    .then(data => {
        menuItems = data;
        renderMenuItems();
    })
    .catch(error => console.error('Error fetching menu:', error));
}

function fetchTables() {
    const token = localStorage.getItem('access_token');
    fetch(table_url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html'; // Redirect to expired page
            throw new Error('Unauthorized');
        }
        return response.json();
    })
    .then(data => {
        tables = data;
        renderTables();
    })
    .catch(error => console.error('Error fetching tables:', error));
}

function renderMenuItems() {
    const menuGrid = document.getElementById('menu-grid');
    menuGrid.innerHTML = '';
    const searchTerm = document.getElementById('search-items').value.toLowerCase();

    // Filter and sort items: available items first, then unavailable
    const filteredItems = menuItems
        .filter(item => item.name.toLowerCase().includes(searchTerm))
        .sort((a, b) => {
            if (a.is_available && !b.is_available) return -1; // a is available, b is not
            if (!a.is_available && b.is_available) return 1;  // a is not available, b is
            return 0; // both have the same availability status
        });

    filteredItems.forEach(item => {
        const div = document.createElement('div');
        div.className = `menu-item ${item.is_available ? '' : 'unavailable'}`;
        div.innerHTML = `
            <img src="${menu_url}${item.img_path || 'https://via.placeholder.com/150'}" alt="${item.name}">
            <div>
                ${item.name}<br>
                ${parseFloat(item.price).toLocaleString()}
                ${item.is_available ? '' : '<br><span style="color: #dc3545; font-size: 0.9em;">Unavailable</span>'}
            </div>
            <input type="number" id="quantity-${item.id}" min="0" value="0" ${item.is_available ? '' : 'disabled'}>
            <input type="text" id="note-${item.id}" placeholder="Note" ${item.is_available ? '' : 'disabled'}>
            <button onclick="addItem(${item.id})" ${item.is_available ? '' : 'disabled'}>Add</button>
        `;
        menuGrid.appendChild(div);
    });
}

function renderTables() {
    const tablesGrid = document.getElementById('tables-grid');
    tablesGrid.innerHTML = '';
    tables.forEach(table => {
        const div = document.createElement('div');
        div.className = `table ${table.is_available ? 'available' : 'unavailable'} ${selectedTableId === table.id ? 'selected' : ''}`;
        div.dataset.tableId = table.id; // Store table ID for selection
        div.textContent = `Table ${table.id}`;
        tablesGrid.appendChild(div);
    });
}

function selectTable(event) {
    const target = event.target;
    if (target.classList.contains('table') && target.classList.contains('available')) {
        selectedTableId = parseInt(target.dataset.tableId);
        renderTables(); // Re-render to show the selected table
        closeTablesModal(); // Close the modal after selection
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`; // Add success or error class
    notification.style.display = 'block';

    // Log the message
    updateMessageLog(message, type);

    // Hide the notification after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function updateMessageLog(message, type) {
    const timestamp = new Date().toLocaleTimeString(); // Get current time
    recentMessages.unshift({ message, type, timestamp }); // Add to the beginning
    if (recentMessages.length > 5) {
        recentMessages.pop(); // Keep only the last 5 messages
    }

    const messageLog = document.getElementById('message-log');
    messageLog.innerHTML = recentMessages
        .map(msg => `
            <div class="message-item ${msg.type}">
                [${msg.timestamp}] ${msg.message}
            </div>
        `)
        .join('');
}

function renderOrderItems() {
    const orderItemsDiv = document.getElementById('order-items');
    orderItemsDiv.innerHTML = '';
    const searchTerm = document.getElementById('search-order-items').value.toLowerCase();

    orderItems
        .filter(item => item.name.toLowerCase().includes(searchTerm))
        .forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'order-item';
            div.innerHTML = `
                <img src="${menu_url}${item.img_path || 'https://via.placeholder.com/50'}" alt="${item.name}">
                <div>
                    ${item.name}<br>
                    Qty: ${item.quantity}
                </div>
                <button onclick="removeItem(${index})">Remove</button>
            `;
            orderItemsDiv.appendChild(div);
        });
}

function addItem(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item.is_available) return; // Prevent adding unavailable items
    const quantity = parseInt(document.getElementById(`quantity-${itemId}`).value) || 0;
    const note = document.getElementById(`note-${itemId}`).value;

    if (quantity > 0) {
        orderItems.push({ ...item, quantity, note });
        renderOrderItems();
    }
}

function removeItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
}

function filterItems() {
    renderMenuItems();
}

function filterOrderItems() {
    renderOrderItems();
}

function switchTab(tab) {
    // Update active tab button
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab).classList.add('active');

    // Hide order basket when not in create-order tab
    const basket = document.getElementById('order-basket');
    if (tab === 'create-order') {
        basket.style.display = 'block';
        if (isBasketOpen) basket.style.width = '300px';
    } else {
        basket.style.display = 'none';
    }
}

function openTablesModal() {
    document.getElementById('tables-modal').style.display = 'flex';
}

function closeTablesModal() {
    document.getElementById('tables-modal').style.display = 'none';
}

function toggleBasket() {
    isBasketOpen = !isBasketOpen;
    const basket = document.getElementById('order-basket');
    basket.style.width = isBasketOpen ? '300px' : '0';
    basket.querySelector('button').textContent = isBasketOpen ? 'Close Basket' : 'Open Basket';
}

function createOrder() {
    if (!selectedTableId) {
        showNotification('Please select a table first', 'error');
        return;
    }

    if (orderItems.length === 0) {
        showNotification('Please add at least one item to the order', 'error');
        return;
    }

    const token = localStorage.getItem('access_token');

    const orderData = {
        table_id: selectedTableId,
        order_items: orderItems.map(item => ({
            item_id: item.id,
            quantity: item.quantity,
            note: item.note || ''
        }))
    };

    fetch(orders_url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to create order');
        }
        return response.json();
    })
    .then(data => {
        showNotification('Order created successfully', 'success');
        orderItems = [];
        selectedTableId = null; // Reset selected table
        renderOrderItems();
        renderTables(); // Reset table selection UI
    })
    .catch(error => {
        showNotification(error.message || 'Failed to create order', 'error');
        console.error('Error creating order:', error);
    });
}
function logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login.html'; // Redirect to login page
}