// script.js
let menuItems = [];
let tables = [];
let orderItems = [];
let isBasketOpen = true;
let selectedTableId = null; // Track the selected table
let recentMessages = [];
let orders = []; // Store fetched orders
let ordersOffset = 0; // For pagination
const ordersLimit = 10; // Number of orders to fetch per page
let orderItemsWithIds = {}; // Cache order items with their IDs
let currentOrderIdForAddingItems = null; // Track which order is being extended

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

// Fetch orders with pagination
function fetchOrders(append = true) {
    const token = localStorage.getItem('access_token');
    fetch(`${orders_url}?offset=${ordersOffset}&limit=${ordersLimit}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        return response.json();
    })
    .then(data => {
        if (append) {
            orders = orders.concat(data);
        } else {
            orders = data;
            ordersOffset = 0; // Reset offset on refresh
        }
        renderOrders();
        // Hide "Load More" button if no more orders
        document.getElementById('load-more-orders').style.display = data.length < ordersLimit ? 'none' : 'block';
    })
    .catch(error => {
        showNotification(error.message || 'Failed to fetch orders', 'error');
        console.error('Error fetching orders:', error);
    });
}

// Load more orders (pagination)
function loadMoreOrders() {
    ordersOffset += ordersLimit;
    fetchOrders(true);
}

// Fetch full order details to get order item IDs
function fetchOrderDetails(orderId) {
    const token = localStorage.getItem('access_token');
    return fetch(`${orders_url}${orderId}/`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch order details');
        }
        return response.json();
    })
    .then(data => {
        // Cache order items with their IDs
        data.order_items.forEach(item => {
            orderItemsWithIds[`${orderId}-${item.item_id}`] = item.id;
        });
        return data;
    });
}

// Render orders in the "Manage Order" tab
function renderOrders() {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';
    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        orderCard.innerHTML = `
            <div class="order-header">
                <div>
                    <strong>Order #${order.id}</strong> | Table ${order.table_id}<br>
                    Status: <select onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="opening" ${order.status === 'opening' ? 'selected' : ''}>Opening</option>
                        <option value="closed" ${order.status === 'closed' ? 'selected' : ''}>Closed</option>
                        <option value="canceled" ${order.status === 'canceled' ? 'selected' : ''}>Canceled</option>
                    </select><br>
                    Total: ${parseFloat(order.total_amount).toLocaleString()}<br>
                    Created: ${new Date(order.created_at).toLocaleString()}<br>
                    Items: ${order.order_items.length}
                </div>
                <div>
                    <button onclick="toggleOrderDetails(${order.id})">Expand</button>
                    <button onclick="togglePaidStatus(${order.id}, ${order.is_paid})">
                        ${order.is_paid ? 'Mark as Unpaid' : 'Mark as Paid'}
                    </button>
                </div>
            </div>
            <div id="order-details-${order.id}" class="order-details"></div>
        `;
        ordersList.appendChild(orderCard);
    });
}

// Toggle order details visibility and fetch details if needed
function toggleOrderDetails(orderId) {
    const detailsDiv = document.getElementById(`order-details-${orderId}`);
    const isVisible = detailsDiv.classList.contains('active');
    if (isVisible) {
        detailsDiv.classList.remove('active');
    } else {
        fetchOrderDetails(orderId)
            .then(order => {
                renderOrderDetails(order);
                detailsDiv.classList.add('active');
            })
            .catch(error => {
                showNotification('Failed to fetch order details', 'error');
                console.error('Error fetching order details:', error);
            });
    }
}

// Render order details (order items)
function renderOrderDetails(order) {
    const detailsDiv = document.getElementById(`order-details-${order.id}`);
    detailsDiv.innerHTML = `
        <button onclick="openAddItemsModal(${order.id})">Add More Items</button>
        <h4>Order Items</h4>
    `;
    order.order_items.forEach(item => {
        const itemDetails = menuItems.find(menuItem => menuItem.id === item.item_id) || { name: `Item ${item.item_id}` };
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        itemDiv.innerHTML = `
            <div>
                <strong>${itemDetails.name}</strong><br>
                Quantity: <input type="number" id="quantity-${order.id}-${item.item_id}" value="${item.quantity}" min="1"><br>
                Note: <input type="text" id="note-${order.id}-${item.item_id}" value="${item.note || ''}"><br>
                Status: <select id="status-${order.id}-${item.item_id}">
                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="canceled" ${item.status === 'canceled' ? 'selected' : ''}>Canceled</option>
                </select>
            </div>
            <button onclick="updateOrderItem(${order.id}, ${item.item_id})">Save</button>
        `;
        detailsDiv.appendChild(itemDiv);
    });
}

function updateOrderStatus(orderId, newStatus) {
    const token = localStorage.getItem('access_token');
    fetch(`${orders_url}${orderId}/`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to update order status');
        }
        return response.json();
    })
    .then(data => {
        showNotification('Order status updated successfully', 'success');
        updateMessageLog('Order status updated successfully', 'success');
        // Update will be handled via WebSocket
    })
    .catch(error => {
        showNotification(error.message || 'Failed to update order status', 'error');
        console.error('Error updating order status:', error);
    });
}

function togglePaidStatus(orderId, currentIsPaid) {
    const token = localStorage.getItem('access_token');
    fetch(`${orders_url}${orderId}/`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_paid: !currentIsPaid })
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to update paid status');
        }
        return response.json();
    })
    .then(data => {
        showNotification(`Order marked as ${!currentIsPaid ? 'paid' : 'unpaid'}`, 'success');
        updateMessageLog(`Order marked as ${!currentIsPaid ? 'paid' : 'unpaid'}`, 'success');
        // Update will be handled via WebSocket
    })
    .catch(error => {
        showNotification(error.message || 'Failed to update paid status', 'error');
        console.error('Error updating paid status:', error);
    });
}

function submitNewItems() {
    if (!currentOrderIdForAddingItems) return;

    const newItems = menuItems
        .filter(item => item.is_available)
        .map(item => {
            const quantity = parseInt(document.getElementById(`add-quantity-${item.id}`).value) || 0;
            const note = document.getElementById(`add-note-${item.id}`).value;
            if (quantity > 0) {
                return { item_id: item.id, quantity, note };
            }
            return null;
        })
        .filter(item => item !== null);

    if (newItems.length === 0) {
        showNotification('Please add at least one item', 'error');
        return;
    }

    const token = localStorage.getItem('access_token');
    fetch(`${orders_url}${currentOrderIdForAddingItems}/extend`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItems)
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/expired.html';
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            throw new Error('Failed to add items to order');
        }
        return response.json();
    })
    .then(data => {
        showNotification('Items added to order successfully', 'success');
        updateMessageLog('Items added to order successfully', 'success');
        closeAddItemsModal();
        // Update will be handled via WebSocket
    })
    .catch(error => {
        showNotification(error.message || 'Failed to add items to order', 'error');
        console.error('Error adding items to order:', error);
    });
}
// Open modal to add more items
function openAddItemsModal(orderId) {
    currentOrderIdForAddingItems = orderId;
    const addItemsGrid = document.getElementById('add-items-grid');
    addItemsGrid.innerHTML = '';
    menuItems
        .filter(item => item.is_available)
        .forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'add-item-card';
            itemCard.innerHTML = `
                <img src="${menu_url}${item.img_path || 'https://via.placeholder.com/100'}" alt="${item.name}">
                <div>
                    ${item.name}<br>
                    ${parseFloat(item.price).toLocaleString()}
                </div>
                <input type="number" id="add-quantity-${item.id}" min="0" value="0">
                <input type="text" id="add-note-${item.id}" placeholder="Note">
            `;
            addItemsGrid.appendChild(itemCard);
        });
    document.getElementById('add-items-modal').style.display = 'flex';
}

// Close the add items modal
function closeAddItemsModal() {
    document.getElementById('add-items-modal').style.display = 'none';
    currentOrderIdForAddingItems = null;
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

/*Order Management*/

let websocket = null;

// Connect to WebSocket
// function connectWebSocket() {
//     websocket = new WebSocket(`ws://localhost:8003/ws/${role}`);
//     websocket.onopen = () => {
//         console.log('WebSocket connected');
//     };
//     // websocket.onmessage = (event) => {
//     //     const message = JSON.parse(event.data);
//     //     if (message.event === 'order_updated') {
//     //         handleOrderUpdate(message.data);
//     //     } else if (message.event === 'order_item_updated') {
//     //         handleOrderItemUpdate(message.data);
//     //     }
//     // };
//     websocket.onclose = () => {
//         console.log('WebSocket disconnected, reconnecting...');
//         setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
//     };
//     websocket.onerror = (error) => {
//         console.error('WebSocket error:', error);
//     };
// }

// Handle order update event
function handleOrderUpdate(updatedOrder) {
    const orderIndex = orders.findIndex(o => o.id === updatedOrder.id);
    if (orderIndex !== -1) {
        orders[orderIndex] = updatedOrder;
    } else {
        orders.push(updatedOrder);
    }
    renderOrders();
    showNotification('Order updated in real-time', 'success');
    updateMessageLog('Order updated in real-time', 'success');
}

// Handle order item update event
function handleOrderItemUpdate(updatedItem) {
    const order = orders.find(o => o.order_items.some(item => item.id === updatedItem.id));
    if (order) {
        const itemIndex = order.order_items.findIndex(item => item.id === updatedItem.id);
        if (itemIndex !== -1) {
            order.order_items[itemIndex] = updatedItem;
            renderOrders();
            const detailsDiv = document.getElementById(`order-details-${order.id}`);
            if (detailsDiv.classList.contains('active')) {
                renderOrderDetails(order);
                detailsDiv.classList.add('active');
            }
            showNotification('Order item updated in real-time', 'success');
            updateMessageLog('Order item updated in real-time', 'success');
        }
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab).classList.add('active');

    const basket = document.getElementById('order-basket');
    if (tab === 'create-order') {
        basket.style.display = 'block';
        if (isBasketOpen) basket.style.width = '300px';
    } else {
        basket.style.display = 'none';
    }

    if (tab === 'manage-order') {
        // Fetch menuItems if not loaded
        if (menuItems.length === 0) {
            fetchMenu();
        }
        fetchOrders(false); // Initial fetch
        if (!websocket) {
            connectWebSocket(); // Initialize WebSocket
        }
    }
}