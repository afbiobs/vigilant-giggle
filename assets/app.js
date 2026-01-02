/**
 * THOUGHT FOR THE DAY - APP LOGIC
 * Modern, efficient implementation with progressive loading
 */

class ThoughtApp {
    constructor() {
        this.currentDay = null;
        this.index = null;
        this.cache = new Map(); // Cache loaded thoughts
        this.timezone = 'Europe/London';
        
        // DOM elements
        this.elements = {
            loading: document.getElementById('loading'),
            app: document.getElementById('app'),
            error: document.getElementById('error'),
            errorMessage: document.getElementById('error-message'),
            dateDay: document.getElementById('current-day'),
            dateFull: document.getElementById('current-date'),
            thoughtContent: document.getElementById('thought-content'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            todayBtn: document.getElementById('today-btn'),
            navBtn: document.getElementById('nav-btn'),
            closeMenuBtn: document.getElementById('close-menu-btn'),
            navMenu: document.getElementById('nav-menu'),
            menuBackdrop: document.getElementById('menu-backdrop'),
            dayList: document.getElementById('day-list')
        };
        
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load index first
            await this.loadIndex();
            
            // Determine which day to show
            const dayToShow = this.determineDayToShow();
            
            // Load and display that day
            await this.showDay(dayToShow);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Populate day list in menu
            this.populateDayList();
            
            // Hide loading, show app
            this.showApp();
            
            // Preload adjacent days
            this.preloadAdjacentDays(dayToShow);
            
        } catch (error) {
            this.showError('Failed to load content. Please check your connection and try again.');
            console.error('Initialization error:', error);
        }
    }
    
    /**
     * Load the index file
     */
    async loadIndex() {
        try {
            const response = await fetch('data/index.json');
            if (!response.ok) throw new Error('Index not found');
            this.index = await response.json();
            
            if (!this.index.days || this.index.days.length === 0) {
                throw new Error('No days found in index');
            }
        } catch (error) {
            throw new Error(`Failed to load index: ${error.message}`);
        }
    }
    
    /**
     * Determine which day to show based on current date
     */
    determineDayToShow() {
        // Check URL parameter first
        const params = new URLSearchParams(window.location.search);
        const dayParam = params.get('day');
        
        if (dayParam) {
            const day = parseInt(dayParam);
            if (this.isDayValid(day)) {
                return day;
            }
        }
        
        // Calculate day of year in specified timezone
        const zonedDate = this.getCurrentDateInTimezone();
        const dayOfYear = this.getDayOfYear(zonedDate);

        // Use current day if available, otherwise map to the available range
        if (this.isDayValid(dayOfYear)) {
            return dayOfYear;
        }

        const sortedDays = [...this.index.days].sort((a, b) => a.day - b.day);
        const dayIndex = (dayOfYear - 1) % sortedDays.length;
        return sortedDays[dayIndex].day;
    }

    /**
     * Get the current date adjusted to the configured timezone
     */
    getCurrentDateInTimezone() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: this.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year').value, 10);
        const month = parseInt(parts.find(p => p.type === 'month').value, 10);
        const day = parseInt(parts.find(p => p.type === 'day').value, 10);

        // Create a Date in UTC to avoid timezone drift when calculating day of year
        return new Date(Date.UTC(year, month - 1, day));
    }

    /**
     * Get the day of year (1-based) from a Date object
     */
    getDayOfYear(date) {
        const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
        const diff = date.getTime() - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay) + 1;
    }
    
    /**
     * Check if a day number is valid
     */
    isDayValid(day) {
        return this.index.days.some(d => d.day === day);
    }
    
    /**
     * Load a specific day's content
     */
    async loadDay(dayNum) {
        // Check cache first
        if (this.cache.has(dayNum)) {
            return this.cache.get(dayNum);
        }
        
        try {
            const filename = `data/day-${String(dayNum).padStart(3, '0')}.json`;
            const response = await fetch(filename);
            
            if (!response.ok) {
                throw new Error(`Day ${dayNum} not found`);
            }
            
            const data = await response.json();
            
            // Cache the result
            this.cache.set(dayNum, data);
            
            return data;
            
        } catch (error) {
            throw new Error(`Failed to load day ${dayNum}: ${error.message}`);
        }
    }
    
    /**
     * Display a specific day
     */
    async showDay(dayNum) {
        try {
            const thought = await this.loadDay(dayNum);
            
            // Update current day
            this.currentDay = dayNum;
            
            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('day', dayNum);
            window.history.pushState({}, '', url);
            
            // Update date display
            this.updateDateDisplay(thought);
            
            // Update content
            this.elements.thoughtContent.innerHTML = thought.html;
            
            // Update navigation buttons
            this.updateNavigationButtons();
            
            // Smooth scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (error) {
            this.showError(`Unable to load day ${dayNum}. ${error.message}`);
            console.error('Show day error:', error);
        }
    }
    
    /**
     * Update the date display
     */
    updateDateDisplay(thought) {
        // Update day number
        this.elements.dateDay.textContent = `Day ${thought.day}`;
        
        // Update full date (current date)
        const now = this.getCurrentDateInTimezone();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: this.timezone
        };
        this.elements.dateFull.textContent = now.toLocaleDateString('en-GB', options);
    }
    
    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
        const currentIndex = this.index.days.findIndex(d => d.day === this.currentDay);
        
        // Previous button
        this.elements.prevBtn.disabled = currentIndex === 0;
        
        // Next button  
        this.elements.nextBtn.disabled = currentIndex === this.index.days.length - 1;
    }
    
    /**
     * Navigate to previous day
     */
    async gotoPreviousDay() {
        const currentIndex = this.index.days.findIndex(d => d.day === this.currentDay);
        if (currentIndex > 0) {
            const prevDay = this.index.days[currentIndex - 1].day;
            await this.showDay(prevDay);
        }
    }
    
    /**
     * Navigate to next day
     */
    async gotoNextDay() {
        const currentIndex = this.index.days.findIndex(d => d.day === this.currentDay);
        if (currentIndex < this.index.days.length - 1) {
            const nextDay = this.index.days[currentIndex + 1].day;
            await this.showDay(nextDay);
        }
    }
    
    /**
     * Navigate to today's day
     */
    async gotoToday() {
        const todayDay = this.determineDayToShow();
        await this.showDay(todayDay);
    }
    
    /**
     * Preload adjacent days for faster navigation
     */
    async preloadAdjacentDays(dayNum) {
        const currentIndex = this.index.days.findIndex(d => d.day === dayNum);
        
        // Preload previous day
        if (currentIndex > 0) {
            const prevDay = this.index.days[currentIndex - 1].day;
            this.loadDay(prevDay).catch(() => {}); // Silent fail
        }
        
        // Preload next day
        if (currentIndex < this.index.days.length - 1) {
            const nextDay = this.index.days[currentIndex + 1].day;
            this.loadDay(nextDay).catch(() => {}); // Silent fail
        }
    }
    
    /**
     * Populate the day list in the navigation menu
     */
    populateDayList() {
        this.elements.dayList.innerHTML = '';
        
        this.index.days.forEach(day => {
            const button = document.createElement('button');
            button.className = 'day-item';
            button.innerHTML = `
                <div class="day-item-number">Day ${day.day}</div>
                <div class="day-item-title">${this.escapeHtml(day.title)}</div>
            `;
            button.addEventListener('click', async () => {
                await this.showDay(day.day);
                this.closeMenu();
            });
            this.elements.dayList.appendChild(button);
        });
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation buttons
        this.elements.prevBtn.addEventListener('click', () => this.gotoPreviousDay());
        this.elements.nextBtn.addEventListener('click', () => this.gotoNextDay());
        this.elements.todayBtn.addEventListener('click', () => this.gotoToday());
        
        // Menu toggle
        this.elements.navBtn.addEventListener('click', () => this.openMenu());
        this.elements.closeMenuBtn.addEventListener('click', () => this.closeMenu());
        this.elements.menuBackdrop.addEventListener('click', () => this.closeMenu());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.elements.navMenu.classList.contains('active')) {
                if (e.key === 'Escape') {
                    this.closeMenu();
                }
                return;
            }
            
            if (e.key === 'ArrowLeft') {
                this.gotoPreviousDay();
            } else if (e.key === 'ArrowRight') {
                this.gotoNextDay();
            }
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            const params = new URLSearchParams(window.location.search);
            const day = parseInt(params.get('day')) || this.determineDayToShow();
            this.showDay(day);
        });
    }
    
    /**
     * Open navigation menu
     */
    openMenu() {
        this.elements.navMenu.classList.add('active');
        this.elements.menuBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Close navigation menu
     */
    closeMenu() {
        this.elements.navMenu.classList.remove('active');
        this.elements.menuBackdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    /**
     * Show the app (hide loading)
     */
    showApp() {
        setTimeout(() => {
            this.elements.loading.style.display = 'none';
            this.elements.app.style.display = 'block';
            this.elements.error.style.display = 'none';
        }, 300); // Small delay for smooth transition
    }
    
    /**
     * Show error state
     */
    showError(message) {
        this.elements.loading.style.display = 'none';
        this.elements.app.style.display = 'none';
        this.elements.error.style.display = 'flex';
        this.elements.errorMessage.textContent = message;
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ThoughtApp());
} else {
    new ThoughtApp();
}

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Silent fail - service worker is optional
        });
    });
}
