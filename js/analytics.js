/**
 * Miami Alliance 3PL Analytics Module
 * GA4 Event Tracking with Safety Checks
 *
 * Usage: MA3PLAnalytics.trackQuoteCalculation('standard', {l:10,w:10,h:10}, 5, 250.00)
 */
(function() {
  'use strict';

  var MA3PLAnalytics = {
    debug: false,

    /**
     * Core tracking helper - wraps gtag with safety check
     * @param {string} eventName - GA4 event name
     * @param {Object} params - Event parameters
     */
    track: function(eventName, params) {
      if (this.debug) {
        console.log('[MA3PL Analytics] Event:', eventName, params);
      }

      if (typeof gtag === 'function') {
        gtag('event', eventName, params);
      } else if (this.debug) {
        console.warn('[MA3PL Analytics] gtag not available');
      }
    },

    /**
     * Track quote calculation completion
     * @param {string} packageType - e.g., 'standard', 'fragile', 'oversized'
     * @param {Object} dimensions - {length, width, height}
     * @param {number} quantity - Number of units
     * @param {number} total - Total quote amount
     */
    trackQuoteCalculation: function(packageType, dimensions, quantity, total) {
      this.track('generate_lead', {
        currency: 'USD',
        value: total,
        lead_source: 'quote_calculator',
        package_type: packageType,
        item_dimensions: dimensions.length + 'x' + dimensions.width + 'x' + dimensions.height,
        quantity: quantity
      });
    },

    /**
     * Track PDF quote download
     * @param {string} quoteNumber - Unique quote identifier
     * @param {number} total - Quote total amount
     */
    trackPDFDownload: function(quoteNumber, total) {
      this.track('file_download', {
        file_name: 'quote_' + quoteNumber + '.pdf',
        file_extension: 'pdf',
        content_type: 'quote',
        currency: 'USD',
        value: total
      });
    },

    /**
     * Track form submission
     * @param {string} formName - Name/identifier of the form
     * @param {boolean} success - Whether submission was successful
     */
    trackFormSubmit: function(formName, success) {
      if (success) {
        this.track('form_submit', {
          form_name: formName,
          form_destination: window.location.pathname,
          form_submit_text: 'Submit'
        });
      } else {
        this.track('form_error', {
          form_name: formName,
          error_type: 'submission_failed'
        });
      }
    },

    /**
     * Track user login
     * @param {string} method - Login method (e.g., 'email', 'google', 'phone')
     */
    trackLogin: function(method) {
      this.track('login', {
        method: method
      });
    },

    /**
     * Track user signup/registration
     * @param {string} method - Signup method (e.g., 'email', 'google', 'phone')
     */
    trackSignup: function(method) {
      this.track('sign_up', {
        method: method
      });
    },

    /**
     * Track CTA button clicks
     * @param {string} buttonText - Text displayed on the button
     * @param {string} location - Where on the page (e.g., 'hero', 'footer', 'sidebar')
     */
    trackCTAClick: function(buttonText, location) {
      this.track('select_content', {
        content_type: 'cta_button',
        content_id: buttonText.toLowerCase().replace(/\s+/g, '_'),
        button_text: buttonText,
        button_location: location
      });
    },

    /**
     * Track chat widget opened
     */
    trackChatOpen: function() {
      this.track('chat_open', {
        chat_type: 'support',
        page_location: window.location.pathname
      });
    },

    /**
     * Track chat message sent
     * @param {boolean} isFirstMessage - Whether this is the first message in the session
     */
    trackChatMessage: function(isFirstMessage) {
      this.track('chat_message', {
        chat_type: 'support',
        is_first_message: isFirstMessage,
        page_location: window.location.pathname
      });
    }
  };

  // Expose to global scope
  window.MA3PLAnalytics = MA3PLAnalytics;

})();
