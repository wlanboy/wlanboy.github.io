import { generateCowSay } from './cowsay.js';

const terminalInput = document.getElementById('terminalInput');
const terminalOutput = document.getElementById('terminalOutput');
const homepageContent = document.getElementById('homepage').innerHTML;
const themeToggleButton = document.getElementById('themeToggleButton');
const htmlElement = document.documentElement; // Refers to the <html> tag

// Function to set the theme based on the current mode
function setTheme(mode) {
    if (mode === 'dark') {
        htmlElement.classList.add('dark-mode');
        htmlElement.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark'); // Save preference
    } else if (mode === 'light') {
        htmlElement.classList.add('light-mode');
        htmlElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light'); // Save preference
    } else { // System default
        htmlElement.classList.remove('dark-mode', 'light-mode');
        localStorage.removeItem('theme'); // Remove preference, let system decide
    }
}

// Initialize theme based on local storage or system preference
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme); // Use saved theme
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark'); // Default to dark if system prefers it and no saved theme
    } else {
        setTheme('light'); // Default to light if no saved theme and system prefers light
    }
}


const commands = {
    'help': 'Available commands: <span class="menu-command">help</span>, <span class="menu-command">clear</span>, <span class="menu-command">menu</span>, <span class="menu-command">homelab</span>, <span class="menu-command">github</span>, <span class="menu-command">minipcs</span>.',
    'menu': 'Available pages: <span class="menu-command">homelab</span> (Homelab Software), <span class="menu-command">github</span> (GitHub Repos), <span class="menu-command">minipcs</span> (Mini PCs).',
    'homelab': 'Loading Homelab Software...',
    'github': 'Loading GitHub Repositories...',
    'minipcs': 'Loading Mini PCs information...',
    'cowsay': 'A cow living on the terminal lands...',
    'clear': '' // Handled separately
};

function addOutput(text, isCommand = false) {
    const p = document.createElement('p');
    if (isCommand) {
        p.innerHTML = `<span style="color: limegreen;">user@homelab:~ $</span> ${text}`;
    } else {
        p.innerHTML = text;
    }
    terminalOutput.appendChild(p);
    terminalOutput.scrollTop = terminalOutput.scrollHeight; // Auto-scroll to bottom
}

function showPageContent(pageId) {
    const targetPageDiv = document.getElementById(pageId);
    if (targetPageDiv) {
        terminalOutput.innerHTML = ''; // Clear existing output
        const clonedContent = targetPageDiv.cloneNode(true); // Clone the content
        clonedContent.style.display = 'block'; // Ensure cloned content is visible
        terminalOutput.appendChild(clonedContent); // Append cloned content to terminal output
        terminalOutput.scrollTop = terminalOutput.scrollTop + clonedContent.offsetHeight; // Scroll to bottom
    }
}

terminalInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const fullCommand = terminalInput.value.trim();
        const parts = fullCommand.split(' ');
        const command = parts[0].toLowerCase(); // Only the command itself should be lowercased
        const message = parts.slice(1).join(' '); // Get the rest as message

        addOutput(fullCommand, true); // Echo the command

        if (command === 'clear') {
            terminalOutput.innerHTML = homepageContent; // Restore homepage content
        } else if (command === 'cowsay') {
            const cowArt = generateCowSay(message);
            addOutput(cowArt);
        } else if (commands[command]) {
            if (command === 'homelab' || command === 'github' || command === 'minipcs') {
                addOutput(commands[command]); // Show "Loading..." message
                setTimeout(() => showPageContent(command + 'Page'), 100); // Small delay for effect
            } else {
                addOutput(commands[command]);
            }
        } else {
            addOutput(`<span style="color: red;">Error: command not found: ${command}</span>`);
            addOutput('Type \'<span class="menu-command">help</span>\' for a list of commands.');
        }
        terminalInput.value = ''; // Clear the input field
    }
});

// Theme Toggle Button Event Listener
themeToggleButton.addEventListener('click', () => {
    if (htmlElement.classList.contains('dark-mode')) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme(); // Set the initial theme
    terminalOutput.innerHTML = homepageContent; // Set initial content
    terminalInput.focus(); // Focus the input field on load
});