// src/routes/requestRoutes.js
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
  createRequest,
  getMyRequests,
  getAvailableRequests,
  getRequestDetail,
  cancelRequest,
  listRequests,
} = require("../controllers/requestController");

const router = express.Router();

/**
 * POST /api/requests
 * PASSENGER yeni bir talep (request) oluşturur.
 */
router.post("/", authMiddleware, requireRole("PASSENGER"), createRequest);

/**
 * GET /api/requests/my
 * PASSENGER kendi taleplerini görür.
 *
 * Opsiyonel query parametreleri:
 *  - status: PENDING / ACCEPTED / COMPLETED / CANCELLED
 *  - from, to: tarih aralığı (ISO string, createdAt'e göre)
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 10, max: 50)
 */
router.get("/my", authMiddleware, requireRole("PASSENGER"), getMyRequests);

/**
 * GET /api/requests/available
 * DRIVER'ların göreceği, henüz kimsenin almadığı PENDING istekler.
 */
router.get(
  "/available",
  authMiddleware,
  requireRole("DRIVER"),
  getAvailableRequests
);

/**
 * GET /api/requests/:id
 * Tek bir request'in detayını döner.
 *
 * Erişim kuralları:
 *  - ADMIN/COORDINATOR → her request'i görebilir.
 *  - PASSENGER        → sadece kendisine ait request'i görebilir.
 *  - DRIVER           → sadece kendisinin aldığı request'leri görebilir
 *                       (yani bu request için driver'ın trip'i varsa).
 *
 * Dönüş:
 *  { request, trips: [...] }  // trips: bu request'e bağlı tüm trip kayıtları
 */
router.get(
  "/:id",
  authMiddleware,
  requireRole("PASSENGER", "DRIVER", "COORDINATOR", "ADMIN"),
  getRequestDetail
);

/**
 * PATCH /api/requests/:id/cancel
 * PASSENGER kendi PENDING talebini iptal eder.
 *
 * Kurallar:
 * - Request gerçekten var olmalı.
 * - Request ilgili yolcuya (passenger) ait olmalı.
 * - Sadece PENDING durumundaki istekler iptal edilebilir.
 */
router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole("PASSENGER"),
  cancelRequest
);

/**
 * GET /api/requests
 * COORDINATOR ve ADMIN için tüm istekleri listeleyen endpoint.
 *
 * Opsiyonel query parametreleri:
 *  - status: PENDING / ACCEPTED / COMPLETED / CANCELLED
 *  - passengerId: belirli bir yolcunun istekleri
 *  - from, to: tarih aralığı (ISO string, createdAt'e göre)
 *  - page: sayfa numarası (default: 1)
 *  - limit: sayfa başına kayıt sayısı (default: 20, max: 100)
 *
 * Örnek:
 *  GET /api/requests?status=PENDING&page=1&limit=20
 *  GET /api/requests?passengerId=6565...&from=2025-12-01&to=2025-12-10
 */
router.get("/", authMiddleware, requireRole("COORDINATOR", "ADMIN"), listRequests);

module.exports = router;
