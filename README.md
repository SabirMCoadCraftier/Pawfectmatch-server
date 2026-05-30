# PawfectMatch - Backend API

This is the secure Node.js, Express, and MongoDB backend server for the PawfectMatch Pet Adoption Platform. It handles protected route enforcement, JWT-based user authorization, application state persistence, and manages core business logic for pet listings and adoption requests.

## 🔗 Project Links & Live Demo
* **Live Application:** [PawfectMatch Live Website](https://pawfectmatch-client.vercel.app/)
* **Backend Repository:** [GitHub - Pawfectmatch-server](https://github.com/SabirMCoadCraftier/Pawfectmatch-server)
* **Frontend Repository:** [GitHub - Pawfectmatch-client](https://github.com/SabirMCoadCraftier/Pawfectmatch-client)

---

## 🛠️ Tech Stack & NPM Packages Used
* `express` - Minimalist web framework for handling RESTful APIs and middleware routing.
* `mongodb` - Official MongoDB driver for robust communication with the MongoDB Atlas cloud database.
* `jsonwebtoken` (JWT) - Generates and verifies secure stateless authentication tokens.
* `cookie-parser` - Parses HTTP cookie headers for secure, HttpOnly token storage and transmission.
* `cors` - Configures Cross-Origin Resource Sharing rules specifically for the client domain.
* `dotenv` - Manages critical environment variables, database URIs, and encryption keys securely.
* `nodemon` (Dev Dependency) - Speeds up development by automatically restarting the server on file changes.

---

## 📂 Key API Endpoints Covered

### 🐾 Pet Listings Management
* `GET /pets` - Fetch all available pets for adoption (with optional category filtering).
* `GET /pets/:id` - View comprehensive details of a specific pet profile.
* `GET /pets/my` - Protected route to fetch only the pet listings posted by the logged-in user/shelter.
* `POST /pets` - Add a new pet profile to the database (Authenticated).
* `PUT /pets/:id` - Update existing pet metadata or description (Authenticated/Owner only).
* `DELETE /pets/:id` - Permanently remove a pet listing from the portal (Authenticated/Owner only).

### ✉️ Adoption Applications System
* `POST /adoption-requests` - Submit a formal adoption application for a specific pet.
* `GET /adoption-requests/pending/:petId` - Retrieve all pending applications for an owner's listed pet.
* `PATCH /adoption-requests/:id/approve` - Approve a specific request and update the pet's adoption status.
* `PATCH /adoption-requests/:id/reject` - Decline an adoption request.

---

## ⚙️ Local Installation and Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/SabirMCoadCraftier/Pawfectmatch-server.git](https://github.com/SabirMCoadCraftier/Pawfectmatch-server.git)
