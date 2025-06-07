'use strict';
console.clear(); // Очистка консоли перед тестом

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuButton.addEventListener('click', function() {
      mobileMenu.classList.toggle('show');
    });
  
    // Toggle between login and register forms
    const showRegisterForm = document.getElementById('showRegisterForm');
    const showLoginForm = document.getElementById('showLoginForm');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    showRegisterForm.addEventListener('click', function() {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    });
    
    showLoginForm.addEventListener('click', function() {
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  
    // Load airports for search
    loadAirports();
  
    // Flight search form handler
    document.getElementById('flightSearchForm').addEventListener('submit', function(e) {
      e.preventDefault();
      searchFlights();
    });
  
    // Login handler
    document.getElementById('loginButton').addEventListener('click', loginUser);
  
    // Register handler
    document.getElementById('registerButton').addEventListener('click', registerUser);
  
    // Logout handler
    document.getElementById('logoutButton').addEventListener('click', logoutUser);
  
    // Check-in form handler
    document.getElementById('checkinForm').addEventListener('submit', function(e) {
      e.preventDefault();
      findBookingForCheckin();
    });
  
    // Setup modals
    setupModal('bookingModal', 'closeBookingModal');
    setupModal('paymentModal', 'closePaymentModal');
  
    // Check auth status
    checkAuthStatus();
  });
  
  // Setup modal functionality
  function setupModal(modalId, closeButtonId) {
    const modal = document.getElementById(modalId);
    const closeButton = document.getElementById(closeButtonId);
    
    closeButton.addEventListener('click', function() {
      modal.classList.add('hidden');
    });
    
    // Close when clicking outside modal content
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }
  
  // Load airports from API
  async function loadAirports() {
    try {
      const response = await fetch('http://localhost:8080/airports');
      const airports = await response.json();
      
      const departureSelect = document.getElementById('departure');
      const arrivalSelect = document.getElementById('arrival');
      
      airports.forEach(airport => {
        const option = document.createElement('option');
        option.value = airport.id;
        option.textContent = `${airport.city} (${airport.code}) - ${airport.name}`;
        
        departureSelect.appendChild(option.cloneNode(true));
        arrivalSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading airports:', error);
    }
  }
    
  // Search flights
 
 async function searchFlights() {
    try {
        // 1. Get form values
        const departureSelect = document.getElementById('departure');
        const arrivalSelect = document.getElementById('arrival');
        const dateInput = document.getElementById('departureDate');
        
        const departureId = parseInt(departureSelect.value);
        const arrivalId = parseInt(arrivalSelect.value);
        const dateStr = dateInput.value;

        // 2. Validation
        if (!departureId || !arrivalId) {
            throw new Error('Please select both departure and arrival airports');
        }

        if (departureId === arrivalId) {
            throw new Error('Departure and arrival airports must be different');
        }

        // 3. Parse date to match DB format (YYYY-MM-DD HH:MM:SS)
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date format. Please use YYYY-MM-DD');
        }

        const formattedDate = dateObj.toISOString().slice(0, 19).replace('T', ' ');

        // 4. Show loading indicator
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="loader">Loading flights...</div>';

        // 5. Make API request matching DB structure
        const response = await fetch('http://localhost:8080/flights/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plane_id: null, // Will be set by DB
                departure_airport: departureId, // Airport ID (1, 2, 3)
                arrival_airport: arrivalId,    // Airport ID (1, 2, 3)
                departure_time: formattedDate,  // '2025-06-15 08:00:00'
                arrival_time: null,             // Will be calculated by DB
                status: 1                      // Default: Planned
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error occurred');
        }

        // 6. Process results
        const flights = await response.json();
        searchResults.innerHTML = '';

        if (flights.length === 0) {
            searchResults.innerHTML = '<p class="no-flights">No flights found for selected criteria</p>';
            return;
        }

        // 7. Display results matching DB structure
        flights.forEach(flight => {
            const flightCard = document.createElement('div');
            flightCard.className = 'flight-card';
            
            flightCard.innerHTML = `
                <div class="flight-header">
                    <span>Flight #${flight.id}</span>
                    <span>Plane ID: ${flight.plane_id}</span>
                </div>
                <div class="flight-route">
                    <div class="departure">
                        <strong>From:</strong>
                        <span>${getAirportName(flight.departure_airport)}</span>
                        <span>${formatDateTime(flight.departure_time)}</span>
                    </div>
                    <div class="arrival">
                        <strong>To:</strong>
                        <span>${getAirportName(flight.arrival_airport)}</span>
                        <span>${formatDateTime(flight.arrival_time)}</span>
                    </div>
                </div>
                <div class="flight-footer">
                    <span>Status: ${getStatusName(flight.status)}</span>
                    <button onclick="bookFlight(${flight.id})">Book Now</button>
                </div>
            `;
            
            searchResults.appendChild(flightCard);
        });

    } catch (error) {
        console.error('Flight search error:', error);
        document.getElementById('searchResults').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                ${error.message}
            </div>
        `;
    }
}

// Helper functions
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusName(statusId) {
    const statusMap = {
        1: 'Planned',
        2: 'Departed',
        3: 'Arrived',
        4: 'Canceled',
        5: 'Delayed'
    };
    return statusMap[statusId] || 'Unknown';
}

function getAirportName(airportId) {
    const airports = {
        1: 'Kyiv (KBP)',
        2: 'London (LHR)',
        3: 'Paris (CDG)'
    };
    return airports[airportId] || `Airport ${airportId}`;
}
  
   
 
  
  // Create flight card HTML
  function createFlightCard(flight) {
    const card = document.createElement('div');
    card.className = 'flight-card fade-in';
    
    const departureTime = new Date(flight.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const arrivalTime = new Date(flight.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const flightDate = new Date(flight.departure_time).toLocaleDateString('en-US');
    
    const price = flight.price || 500; // Default price if not provided by API
  
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="font-bold text-lg">${flight.departure_airport_code} → ${flight.arrival_airport_code}</h3>
          <p class="text-gray-600 text-sm">${flightDate}</p>
        </div>
        <span class="bg-blue-100 text-blue-800 text-sm font-semibold px-2.5 py-0.5 rounded">${flight.status}</span>
      </div>
      
      <div class="flight-info-grid mb-4">
        <div>
          <p class="text-2xl font-bold">${departureTime}</p>
          <p class="text-gray-600 text-sm">${flight.departure_airport_name}</p>
        </div>
        <div class="flex items-center justify-center">
          <div class="w-full border-t border-gray-300 relative">
            <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-white px-1">
              <i class="fas fa-plane text-gray-400"></i>
            </div>
          </div>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold">${arrivalTime}</p>
          <p class="text-gray-600 text-sm">${flight.arrival_airport_name}</p>
        </div>
      </div>
      
      <div class="flex justify-between items-center">
        <div>
          <p class="text-gray-600 text-sm">Aircraft: ${flight.plane_model}</p>
          <p class="text-gray-600 text-sm">Available seats: ${flight.available_seats}</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-blue-600">$${price.toLocaleString()}</p>
          <button class="book-flight-btn mt-2 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 transition" 
                  data-flight-id="${flight.id}" 
                  data-departure="${flight.departure_airport_name}" 
                  data-arrival="${flight.arrival_airport_name}" 
                  data-date="${flightDate}" 
                  data-time="${departureTime}" 
                  data-price="${price}">
            Book Now
          </button>
        </div>
      </div>
    `;
    
    // Add click handler to book button
    const bookButton = card.querySelector('.book-flight-btn');
    bookButton.addEventListener('click', function() {
      openBookingModal(this.dataset);
    });
    
    return card;
  }
  
  // Open booking modal with flight data
  function openBookingModal(flightData) {
    const modal = document.getElementById('bookingModal');
    const flightInfo = document.getElementById('flightInfo');
    const flightIdInput = document.getElementById('flightIdToBook');
    
    flightInfo.textContent = `${flightData.departure} → ${flightData.arrival}, ${flightData.date} at ${flightData.time}`;
    flightIdInput.value = flightData.flightId;
    
    document.getElementById('bookingPrice').textContent = `$${flightData.price}`;
    
    // Load available seats (placeholder)
    const seatSelect = document.getElementById('seatSelection');
    seatSelect.innerHTML = '<option value="">Loading...</option>';
    
    // Simulate loading seats
    setTimeout(() => {
      seatSelect.innerHTML = '<option value="">Select seat</option>';
      for (let i = 1; i <= 6; i++) {
        const option = document.createElement('option');
        option.value = `${i}A`;
        option.textContent = `${i}A`;
        seatSelect.appendChild(option);
      }
      for (let i = 1; i <= 6; i++) {
        const option = document.createElement('option');
        option.value = `${i}B`;
        option.textContent = `${i}B`;
        seatSelect.appendChild(option);
      }
    }, 500);
    
    modal.classList.remove('hidden');
    
    // Handle booking form submission
    document.getElementById('bookingForm').addEventListener('submit', function(e) {
      e.preventDefault();
      bookFlight();
    });
  }
  
  async function bookFlight() {
    const formData = {
      passenger_name: document.getElementById('passengerName').value,
      email: document.getElementById('passengerEmail').value,
      flight_id: document.getElementById('flightIdToBook').value,
      seat: document.getElementById('seatSelection').value
    };
  
    try {
      const response = await fetch('http://localhost:8080', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString()
      });
      
      const result = await response.text();
      
      if (response.ok) {
        const message = document.createElement('div');
        message.className = 'success-message';
        message.textContent = result;
        document.getElementById('bookingModal').querySelector('.modal-content').prepend(message);
        
        setTimeout(() => {
          document.getElementById('bookingModal').classList.add('hidden');
        }, 3000);
      } else {
        throw new Error(result);
      }
    } catch (error) {
      console.error('Error booking flight:', error);
      const message = document.createElement('div');
      message.className = 'error-message';
      message.textContent = error.message;
      document.getElementById('bookingModal').querySelector('.modal-content').prepend(message);
    }
  }
  
  // User login
  async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8080/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Store token and update UI
        localStorage.setItem('authToken', result.token);
        updateAuthUI(result.user);
      } else {
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.message);
    }
  }
  
  // User registration
  async function registerUser() {
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    
    if (!fullName || !email || !password) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8080/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Store token and update UI
        localStorage.setItem('authToken', result.token);
        updateAuthUI(result.user);
      } else {
        throw new Error(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert(error.message);
    }
  }
  
  // Logout user
  function logoutUser() {
    localStorage.removeItem('authToken');
    updateAuthUI(null);
  }
  
  // Check auth status
  function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
      // In a real app, you would verify the token with the server
      // For this demo, we'll just assume it's valid
      fetchUserProfile();
    }
  }
  
  // Fetch user profile
  async function fetchUserProfile() {
    try {
      const response = await fetch('http://localhost:8080/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        updateAuthUI(user);
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      logoutUser();
    }
  }
  
  // Update UI based on auth status
  function updateAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const userProfile = document.getElementById('userProfile');
    
    if (user) {
      authSection.classList.add('hidden');
      userProfile.classList.remove('hidden');
      
      document.getElementById('userName').textContent = user.full_name;
      document.getElementById('userEmail').textContent = user.email;
      document.getElementById('userPhone').textContent = user.phone || 'Not provided';
      
      // Load user bookings
      loadUserBookings();
    } else {
      authSection.classList.remove('hidden');
      userProfile.classList.add('hidden');
      document.getElementById('userBookings').innerHTML = '<p>Please sign in to view your bookings</p>';
    }
  }
  
  // Load user bookings
  async function loadUserBookings() {
    try {
      const response = await fetch('http://localhost:8080/bookings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const bookings = await response.json();
        displayUserBookings(bookings);
      } else {
        throw new Error('Failed to load bookings');
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      document.getElementById('userBookings').innerHTML = '<p class="error-message">Error loading bookings</p>';
    }
  }
  
  // Display user bookings
  function displayUserBookings(bookings) {
    const bookingsContainer = document.getElementById('userBookings');
    
    if (bookings.length === 0) {
      bookingsContainer.innerHTML = '<p>You have no bookings yet</p>';
      return;
    }
    
    bookingsContainer.innerHTML = '';
    bookings.forEach(booking => {
      const bookingCard = document.createElement('div');
      bookingCard.className = 'flight-card';
      
      const departureTime = new Date(booking.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const flightDate = new Date(booking.departure_time).toLocaleDateString('en-US');
      
      bookingCard.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <div>
            <h3 class="font-bold">${booking.departure_airport_code} → ${booking.arrival_airport_code}</h3>
            <p class="text-gray-600 text-sm">${flightDate} at ${departureTime}</p>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">${booking.status}</span>
        </div>
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm">Seat: ${booking.seat_number}</p>
            <p class="text-sm">Booking Ref: ${booking.booking_ref}</p>
          </div>
          <div>
            <button class="checkin-btn bg-green-600 text-white py-1 px-3 rounded text-sm" data-booking-id="${booking.id}">
              Check-in
            </button>
          </div>
        </div>
      `;
      
      // Add check-in button handler
      const checkinBtn = bookingCard.querySelector('.checkin-btn');
      checkinBtn.addEventListener('click', function() {
        startCheckinProcess(booking.id);
      });
      
      bookingsContainer.appendChild(bookingCard);
    });
  }
  
  // Find booking for check-in
  async function findBookingForCheckin() {
    const bookingRef = document.getElementById('bookingNumber').value;
    const lastName = document.getElementById('lastName').value;
    
    if (!bookingRef || !lastName) {
      alert('Please enter both booking reference and last name');
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:8080/bookings/${bookingRef}?last_name=${lastName}`);
      const booking = await response.json();
      
      if (response.ok) {
        displayCheckinFlights(booking);
      } else {
        throw new Error(booking.message || 'Booking not found');
      }
    } catch (error) {
      console.error('Error finding booking:', error);
      const message = document.createElement('div');
      message.className = 'error-message';
      message.textContent = error.message;
      document.getElementById('checkinForm').appendChild(message);
    }
  }
  
  // Display flights available for check-in
  function displayCheckinFlights(booking) {
    const checkinResults = document.getElementById('checkinResults');
    const flightsContainer = document.getElementById('flightsToCheckin');
    
    checkinResults.classList.remove('hidden');
    flightsContainer.innerHTML = '';
    
    booking.flights.forEach(flight => {
      const flightCard = document.createElement('div');
      flightCard.className = 'flight-card';
      
      const departureTime = new Date(flight.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const flightDate = new Date(flight.departure_time).toLocaleDateString('en-US');
      
      flightCard.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <div>
            <h3 class="font-bold">${flight.departure_airport_code} → ${flight.arrival_airport_code}</h3>
            <p class="text-gray-600 text-sm">${flightDate} at ${departureTime}</p>
          </div>
          <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">${flight.status}</span>
        </div>
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm">Seat: ${flight.seat_number}</p>
          </div>
          <div>
            <button class="complete-checkin-btn bg-green-600 text-white py-1 px-3 rounded text-sm" data-flight-id="${flight.id}">
              Complete Check-in
            </button>
          </div>
        </div>
      `;
      
      // Add complete check-in button handler
      const checkinBtn = flightCard.querySelector('.complete-checkin-btn');
      checkinBtn.addEventListener('click', function() {
        completeCheckin(flight.id);
      });
      
      flightsContainer.appendChild(flightCard);
    });
  }
  
  // Complete check-in process
  async function completeCheckin(flightId) {
    try {
      const response = await fetch('http://localhost:8080/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flight_id: flightId
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('Check-in successful! Your boarding pass has been sent to your email.');
        document.getElementById('checkinResults').classList.add('hidden');
      } else {
        throw new Error(result.message || 'Check-in failed');
      }
    } catch (error) {
      console.error('Error completing check-in:', error);
      alert(error.message);
    }
  }
  
  // Start check-in process from user bookings
  function startCheckinProcess(bookingId) {
    // In a real app, this would open the check-in flow
    alert(`Starting check-in process for booking ${bookingId}`);
  }

  document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Кнопка "' + this.textContent + '" натиснута!', this);
      this.classList.add('click-effect');
      setTimeout(() => this.classList.remove('click-effect'), 300);
    });
  });

  document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(input => {
    input.addEventListener('focus', function() {
      this.style.border = '2px solid #4CAF50';
    });
    input.addEventListener('blur', function() {
      this.style.border = '';
    });
  });


  // Обробка відображення дати
function initDateInput() {
    const dateInput = document.getElementById('departureDate');
    const dateHint = dateInput.nextElementSibling;
    
    if (!dateInput || !dateHint) return;

    dateInput.addEventListener('change', function() {
        // Оновлюємо підказку з актуальною датою
        if (this.value) {
            dateHint.textContent = `Selected: ${this.value} | Format: YYYY-MM-DD`;
        } else {
            dateHint.textContent = 'Format: YYYY-MM-DD';
        }
    });
}

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    initDateInput();
});