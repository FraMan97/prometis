> A P2P (peer-to-peer), private decentralized anonymous chat and file-sharing application built entirely on the Tor network.



Prometis is a messaging system that ensures anonymity and privacy by routing *all* communication through the Tor network. It uses Onion Services for both the clients and the central server, meaning no IP addresses are ever exposed.



Unlike traditional chat apps, there is no central server that reads or relays messages. A lightweight "Discovery Server" exists only to help peers find each other anonymously. All chat sessions and file transfers are direct, peer-to-peer, and end-to-end encrypted (E2EE).

This server is **not required** for the core P2P functionality. The Prometis client is designed to function in a fully decentralized, server-less way.

The client application already includes a "Start Manual Session" feature. Users can bypass the Discovery Server entirely by manually exchanging their `.onion` address and public key (out-of-band) and using this form to establish a direct, end-to-end encrypted session.

For a truly server-less deployment, the features related to the Discovery Server (like the "Subscribe" and "Refresh Active Peers" buttons) can be removed from the client's frontend (`client/local/index.html`) and local backend with minor modifications.



> IMPORTANT: This project is currently a Proof of Concept (POC) and is not suitable for a production environment. It is intended for developer use only.
It was created with the idea of enabling free communication in environments facing dictatorship, censorship, and a lack of free expression, allowing communication without fear of repercussions.
Any use for illegal purposes is neither supported nor encouraged by the developers of this project.

---



## Table of Contents



* [Key Features](#key-features)

* [System Architecture](#system-architecture)

    * [The Discovery Server (`/server`)](#the-discovery-server-server)

    * [The Client (`/client`)](#the-client-client)

    * [Communication Flow](#communication-flow)

* [Technology Stack](#technology-stack)

* [Installation and Setup](#installation-and-setup)

    * [Prerequisites](#prerequisites)

    * [1. Server Setup](#1-server-setup)

    * [2. Client Setup](#2-client-setup)

* [How to Use](#how-to-use)

* [Security Considerations](#security-considerations)

* [Roadmap](#roadmap)


---



## Key Features



* **Complete Anonymity:** Both clients and the discovery server operate as Tor Onion Services. No real IP addresses are ever logged or exposed.

* **End-to-End Encryption (E2EE):** Chat sessions use a robust hybrid-encryption model (RSA-2048 for key exchange, AES-256 for messages). Only the sender and the intended recipient can read messages.

* **True P2P Communication:** After peer discovery, clients communicate directly with each other (`.onion` to `.onion`) with no central middleman.

* **Secure File Sharing:** Users can upload files to a local cache (with a set TTL) and share them with peers, who can download them over the Tor network.

* **Strong Authentication:** All critical API actions (starting a session, sending a message, closing a session) are protected by RSA digital signatures to verify the sender's identity.

* **"Panic" Button:** A one-click reset function that instantly destroys the local RSA keypair, clears all active sessions, and deletes cached files, generating a new identity.

* **No Data Stored Permanently:** No data is saved to disk storage, but only locally in the processor's RAM. All data is deleted once the application is closed or via the PANIC button.



---



## System Architecture



The system is split into two main components:



### The Discovery Server (`/server`)



This is a lightweight Node.js server that acts as an anonymous "phone book."

* It runs as its own Tor Onion Service (`.onion`).

* Its *only* purpose is to maintain a list (in a `node-cache`) of peers who have "subscribed," mapping their `.onion` address to their public key and nickname.

* **It never handles or sees any user messages or files.**

* The `unsubscribe` endpoint is protected by a digital signature to prevent third-party takedowns.



### The Client (`/client`)



This is the application the user runs. It is a hybrid app consisting of a single Node.js backend and a web frontend.



1.  **The Backend (Node.js/Express):** This single process serves two roles:

    * **Local Peer API:** It runs on `localhost` to serve the frontend UI and handle user actions (like sending messages or fetching peers).

    * **Onion Peer API:** It spawns its own Tor process to create a public `.onion` address. It listens on this address to receive E2EE messages and file requests from other peers.

2.  **The Web Frontend (HTML/JS):** A simple UI served to the user's browser. It only ever communicates with the `localhost` backend.



The key component is that the backend **spawns its own Tor process and creates its own Tor Onion Service**.

* All outgoing communication (to the Discovery Server or other peers) is forcibly routed through the local Tor SOCKS proxy using `socks-proxy-agent`.

* The frontend (`index.html`) only talks to the local backend (`localhost:3056`), which handles all cryptography, key management, and anonymous routing.



### Communication Flow



1.  **Client A** starts, creates its `.onion` service, and registers itself (public key, nickname) with the **Discovery Server**.

2.  **Client B** does the same.

3.  **Client A** asks the **Discovery Server** for the list of active peers and receives **Client B**'s data (onion address + public key).

4.  **Client A** contacts **Client B** directly at its `.onion` address to initiate an E2EE session.

5.  All chat and file-sharing communication happens directly between A and B. The Discovery Server is no longer involved.



---



## Technology Stack



* **Backend:** Node.js, TypeScript, Express.js

* **Network & Proxy:** Tor, `socks-proxy-agent`, `axios`

* **Cryptography:** Node.js native `crypto` module (RSA-2048, AES-256)

* **Validation:** Zod (for request schema validation)

* **Frontend:** Vanilla HTML5, CSS3, JavaScript

* **Misc:** `node-cache` (for peer and file caching), `multer` (for file uploads)



---



## Installation and Setup



This project requires manual configuration to set up the Tor services.



### Prerequisites



* Node.js (v18 or later)

* npm (v9 or later)

* **Tor Expert Bundle:** You **must** download the correct Tor Expert Bundle for your OS (Linux, Windows, or macOS) from the [official Tor Project website](https://www.torproject.org/download/expert/).



### 1. Server Setup



The Discovery Server MUST be set up first, as its onion address is required by the clients.



1.  Clone the repository:

    ```bash

    git clone https://github.com/FraMan97/prometis.git

    cd prometis/server

    ```



2.  Install dependencies:

    ```bash

    npm install

    ```



3.  **Configure Tor:**

    * Extract the **Tor Expert Bundle** you downloaded into the `server/` directory.

    * Rename the extracted folder (e.g., `tor-expert-bundle-linux...`) to a simple name, like `tor-bundle`.

    * Edit the `.env` file and set `TOR_BUNDLE_DIR` to match that folder name (e.g., `TOR_BUNDLE_DIR="tor-bundle"`).



4.  Build and start the server:

    ```bash

    tsx ./src/main.ts

    ```

   

5.  **Get the Server's Onion Address:**

    * After starting, Tor will generate the hidden service files.

    * Look in the path you configured: `server/tor-bundle/data/hidden_service/hostname`

    * Open the `hostname` file and copy the `.onion` address (e.g., `tw4dj6...exqd.onion`). **This is your Discovery Server address.**



### 2. Client Setup



1.  Open a **new** terminal and navigate to the `client` directory:

    ```bash

    cd prometis/client

    ```



2.  Install dependencies:

    ```bash

    npm install

    ```



3.  **Configure Tor (same as server):**

    * Extract the **Tor Expert Bundle** into the `client/` directory.

    * Rename the folder to `tor-bundle` (or a name of your choice).

    * Edit the `.env` file and set `TOR_BUNDLE_DIR` (e.g., `TOR_BUNDLE_DIR="tor-bundle"`).



4.  **Link Client to Server:**

    * Open the `client/.env` file.

    * Paste the server's `.onion` address (from step 5 above) into the `DISCOVERY_SERVER_URL` variable. You must also add the port:

        ```env

        DISCOVERY_SERVER_URL="tw4dj6...exqd.onion:3000"

        ```



5.  Build and start the client:

    ```bash

    tsx ./src/main.ts

    ```

    *(Note: This assumes you have `build` and `start` scripts in your `package.json`)*



---



## How to Use



1.  After running `tsx ./src/main.ts` in the `client` directory, the application will start and automatically open your web browser to `http://localhost:3056`.

2.  The interface will display your local configuration data (your own `.onion` address and public key).

3.  **Subscribe:** Enter a nickname and click "Subscribe" to make yourself visible on the Discovery Server.

4.  **Find Peers:** Click "Refresh Active Peers" to download the list of other online users.

5.  **Start Chat:** Click "Start Session" on any peer to initiate an E2EE session. A chat modal will appear.

6.  **Share Files:** Use the "File Management" section to upload a file to your local cache. Other users can then download it using your address and the generated File ID.



---



## Security Considerations



This project was designed with security and anonymity as the highest priorities.



* **No IP Logging:** The Tor Onion Service architecture prevents both clients and the server from ever knowing each other's real IP address.

* **End-to-End Encryption:** Messages are unreadable by anyone except the intended recipient.

* **Authentication:** RSA signatures prevent impersonation (spoofing) by an attacker who only knows your `.onion` address.

* **Frontend-Backend Separation:** The sensitive RSA private key **never** leaves the local backend server. The browser-based UI has no access to sensitive cryptographic material.

* **Path Traversal Protection:** The file download API is secured against path traversal attacks, ensuring a user cannot be tricked into overwriting system files.



---



## Roadmap



Here is future planned developments:

* Add rate limiting for clients and the discovery server.

* Add expiring messages between clients.

* Add online and offline status for clients.

