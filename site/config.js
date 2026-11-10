// Settings for this copy of the dashboard. Every value is optional.
window.FLEET_CONFIG = {
    // "owner/name" of the GitHub repository that holds control.json (branch data) and takes command files (branch main).
    // Empty: taken from the address on <owner>.github.io/<name>/, else the page is public view only.
    repo: '',
    // The game server. The 3D view streams wss://<server>/worldfeed and the Hiscores link opens https://<server>/hiscores.
    server: 'rs-sdk-demo.fly.dev',
};
