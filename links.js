// links.js

export function initLinks() {
    // Coffee link
    const coffeeLink = document.getElementById('coffee-link');
    if (coffeeLink) {
      coffeeLink.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent the default action of opening in the popup
        chrome.tabs.create({ url: 'https://www.paypal.com/donate/?business=TGE9D9GS2WHCU&no_recurring=1&currency_code=EUR' }); // Open in a new tab
      });
    } else {
      console.error('Coffee link not found.');
    }
  
    // Github link
    const githubLink = document.getElementById('github-link');
    if (githubLink) {
      githubLink.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent the default action of opening in the popup
        chrome.tabs.create({ url: 'https://github.com/jonathanbertholet/promptmanager' }); // Open in a new tab
      });
    } else {
      console.error('Github link not found.');
    }
  }
  