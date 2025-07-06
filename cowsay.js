/**
 * Generates an ASCII cow with a speech bubble containing the given message.
 * @param {string} message The message the cow should say.
 * @returns {string} The ASCII art string.
 */
export function generateCowSay(message) {
    const defaultMessage = "Moo!";
    const actualMessage = message.trim() === "" ? defaultMessage : message;
    const messageLines = actualMessage.split('\n');

    let longestLineLength = 0;
    messageLines.forEach(line => {
        if (line.length > longestLineLength) {
            longestLineLength = line.length;
        }
    });

    const topBorder = ' _' + '_'.repeat(longestLineLength + 2) + '_ ';
    const bottomBorder = ' -' + '-'.repeat(longestLineLength + 2) + '- ';

    let bubble = [];
    if (messageLines.length === 1) {
        bubble.push(`< ${actualMessage} >`);
    } else {
        bubble.push(`/${'-'.repeat(longestLineLength + 2)}\\`);
        messageLines.forEach(line => {
            const paddingRight = longestLineLength - line.length;
            bubble.push(`( ${line}${' '.repeat(paddingRight)} )`);
        });
        bubble.push(`\\${'-'.repeat(longestLineLength + 2)}/`);
    }

    const cowArt = `
${topBorder}
${bubble.join('\n')}
${bottomBorder}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
`;
    return `<pre>${cowArt}</pre>`; // Wrap in <pre> for proper display
}