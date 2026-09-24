const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/track", async (req, res) => {
  const resi = String(req.query.resi || "").trim();
  if (!resi) return res.status(400).json({success:false,message:"Nomor resi wajib diisi."});

  /*
    Adapter API:
    Set TRACKING_API_URL dan TRACKING_API_KEY di .env.

    Endpoint provider harus menerima:
      GET {TRACKING_API_URL}?resi=XXXX

    Response provider diharapkan berbentuk:
    {
      "status":"On Delivery",
      "origin":"Jakarta",
      "destination":"Banda Aceh",
      "updated_at":"25 Sep 2026 10:30",
      "events":[
        {"status":"Shipment picked up","location":"Jakarta","time":"25 Sep 2026 08:00"}
      ]
    }

    API key TIDAK pernah dikirim ke browser.
  */

  const base = process.env.TRACKING_API_URL;
  const key = process.env.TRACKING_API_KEY;

  if (!base) {
    return res.status(503).json({
      success:false,
      message:"Tracking API belum dikonfigurasi. Isi TRACKING_API_URL dan TRACKING_API_KEY pada .env."
    });
  }

  try {
    const url = new URL(base);
    url.searchParams.set("resi", resi);

    const headers = {"Accept":"application/json"};
    if (key) headers["Authorization"] = `Bearer ${key}`;

    const response = await fetch(url, {headers});
    const raw = await response.text();

    if (!response.ok) {
      return res.status(502).json({success:false,message:"Provider tracking sedang tidak dapat diakses."});
    }

    const data = JSON.parse(raw);

    return res.json({
      success:true,
      resi,
      status:data.status || data.current_status || "Unknown",
      origin:data.origin || data.from || "-",
      destination:data.destination || data.to || "-",
      updated_at:data.updated_at || data.last_update || "",
      events:Array.isArray(data.events) ? data.events : []
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({success:false,message:"Gagal mengambil data tracking."});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`J&T Tracker running on port ${PORT}`));