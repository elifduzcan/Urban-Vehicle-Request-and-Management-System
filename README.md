# Urban-Vehicle-Request-and-Management-System

🚕 **CityRide – Urban Ride Request & Management System**

CityRide is a lightweight, modular and database-driven web application designed to manage ride requests between passengers and independent drivers within a city. The system provides a structured flow for creating ride requests, assigning drivers, validating users and vehicles, and monitoring trip status — all supported by a clean data model and role-based access control.

This project is developed as part of a **Database Management Systems** course, with a strong focus on **data modeling, normalization, consistency**, and **backend–frontend integration** using a modern web architecture.

---

## ⭐ Key Features

### 👤 Role-Based Access Control (RBAC)

The platform supports four main roles:

- **Passenger** – creates ride requests and tracks trip history  
- **Driver** – views and accepts available requests  
- **Coordinator** – validates drivers and vehicles, manages system records  
- **Admin** – oversees global settings and user permissions  

---

### 📍 Ride Request & Matching Flow

- Passengers create requests with **pickup** and **drop** locations  
- Drivers can **browse and accept** open requests  
- The system ensures that a **driver can only have one active trip at a time**  
- Trip lifecycle is fully tracked:

  `PENDING → ACCEPTED → ON_GOING → COMPLETED / CANCELLED`

---

### 🚗 Driver & Vehicle Verification

- Coordinators **validate driver documents** (license, background check)  
- Vehicles must have valid **insurance/registration** before they can be assigned  
- Verification statuses are **stored in the data model** and checked in business logic  

---

### 🗂️ Clean & Normalized Data Model

Following a **normalization-first** approach, the core collections are:

- **User** – identity & authentication info  
- **Driver** – extended driver details linked to `User`  
- **Vehicle** – vehicles linked to `Driver`  
- **Request** – passenger-generated ride requests  
- **Trip** – accepted and ongoing/completed ride sessions  

The model is organized to **reduce redundancy** and maintain **3NF compliance**.

---

### 🧱 Modern Architecture

- **Frontend:** React  
- **Backend:** Node.js + Express  
- **Database:** MongoDB (Mongoose)  
- **Authentication:** JWT  
- **Pattern:** MVC-inspired service/controller structure  
- **Communication:** RESTful JSON APIs  

This separation ensures a **clear division of concerns** and **easy scalability**.

---

## 🎯 Project Goals

The goal of CityRide is to demonstrate how a ride management platform can be built using **proper DBMS principles** while keeping the implementation **lightweight and modular**. The system focuses on:

- Clean and well-structured **database design**  
- Consistent **request/response handling**  
- Structured **business rules** without database triggers  
- An **expandable architecture** ready for future real-time features (e.g., WebSockets, live tracking)

It serves as an **educational yet realistic example** of how modern ride-matching applications operate behind the scenes.
