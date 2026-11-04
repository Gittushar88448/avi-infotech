// Creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD and syncs indexes.
// Run with --demo to also add sample technicians, jobs, reviews and shop products.
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { Counter, LocationPing, Notification, Query, Review, Settings, SmsLog, User, connectDB, nextSequence } from "../src/lib/db";
import { BillSettings, Category, Customer, Product, Sale, StockMovement } from "../src/lib/store/models";
import { skuCode, toPaise } from "../src/lib/store/money";

const demo = process.argv.includes("--demo");

async function user(name: string, email: string, role: "ADMIN" | "TECHNICIAN", password: string, phone?: string) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, role, phone, passwordHash: await bcrypt.hash(password, 10) });
}

async function main() {
  await connectDB();
  await Promise.all([User, Query, Review, Notification, SmsLog, Counter, LocationPing, Settings, Category, Product, Customer, Sale, StockMovement, BillSettings].map((m) => m.syncIndexes()));
  console.log("Collections and indexes are ready.");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@aviinfotech.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const admin = await user("Admin", adminEmail, "ADMIN", adminPassword);
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);

  if (demo) {
    const techs = [
      await user("Arjun Sharma", "arjun@aviinfotech.local", "TECHNICIAN", "Tech@12345", "+919810000001"),
      await user("Priya Verma", "priya@aviinfotech.local", "TECHNICIAN", "Tech@12345", "+919810000002"),
      await user("Vikram Singh", "vikram@aviinfotech.local", "TECHNICIAN", "Tech@12345", "+919810000003"),
    ];
    console.log("Technicians: arjun@ / priya@ / vikram@aviinfotech.local, password Tech@12345");

    if ((await Query.estimatedDocumentCount()) === 0) {
      const samples: [string, string, string, string, number, string][] = [
        ["4 camera CCTV installation", "CCTV camera", "Meera Kapoor", "Sector 21, Gurugram", 5, "Arjun and Vikram were punctual and neat. All four cameras are crystal clear, even at night. They explained the mobile app patiently."],
        ["NVR not recording", "DVR / NVR", "Rahul Nair", "Indiranagar, Bengaluru", 5, "Hard disk had failed. Replaced the same day and recordings work again. Very professional."],
        ["Video doorbell setup", "Video doorbell", "Sana Qureshi", "Bandra West, Mumbai", 4, "Good install and clean wiring. Took a little longer than expected but the result is great."],
        ["Biometric attendance device offline", "Biometric device", "Deepak Joshi", "Salt Lake, Kolkata", 5, "Fixed the network issue in under an hour and synced all employee data. Highly recommend."],
      ];
      let n = 1001;
      for (const [title, deviceType, customerName, siteAddress, rating, comment] of samples) {
        const crew = n % 2 ? [techs[0], techs[2]] : [techs[1]];
        const q = await Query.create({
          number: n++, title, description: `${title} at customer site.`, deviceType, priority: "MEDIUM", status: "COMPLETED",
          customerName, customerPhone: "+919800000000", siteAddress, createdBy: admin._id, completedAt: new Date(),
          reviewToken: randomBytes(18).toString("base64url"), smsStatus: "SENT",
          assignments: crew.map((t) => ({ user: t._id, acceptedAt: new Date() })),
          activities: [{ actor: admin._id, message: "Created (demo data)" }],
        });
        await Review.create({ query: q._id, rating, comment, customerName });
      }
      await Query.create({
        number: n++, title: "Two cameras offline after power cut", description: "Customer reports cameras 2 and 3 show 'No signal' since last night's power cut. Gate code 4512.",
        deviceType: "CCTV camera", priority: "HIGH", customerName: "Anil Gupta", customerPhone: "+919811112222", siteAddress: "Plot 14, Phase 2, Mohali",
        createdBy: admin._id, assignments: [{ user: techs[0]._id }, { user: techs[1]._id }],
        activities: [{ actor: admin._id, message: "Created and assigned to Arjun Sharma, Priya Verma" }],
      });
      await Counter.updateOne({ _id: "query" }, { value: n - 1001 }, { upsert: true });
      console.log("Added demo jobs and reviews.");
    }

    if ((await Product.estimatedDocumentCount()) === 0) {
      // [name, category, brand, model, barcode, MRP, selling price, GST %, HSN, stock, warranty months]
      const items: [string, string, string, string, string, number, number, number, string, number, number][] = [
        ["2MP HD Dome Camera", "CCTV camera", "Hikvision", "DS-2CE76D0T-ITPF", "6941264012345", 1850, 1600, 18, "85258900", 24, 24],
        ["2MP HD Bullet Camera", "CCTV camera", "Hikvision", "DS-2CE16D0T-ITPF", "6941264012352", 1950, 1700, 18, "85258900", 18, 24],
        ["4MP IP Dome Camera with Audio", "IP camera", "CP Plus", "CP-UNC-DA41PL3", "8904185612340", 4990, 4200, 18, "85258900", 8, 24],
        ["8 Channel DVR", "DVR / NVR", "Hikvision", "DS-7208HQHI-K1", "6941264098761", 6500, 5600, 18, "85219090", 5, 24],
        ["1TB Surveillance Hard Disk", "Storage", "Seagate", "SkyHawk ST1000VX005", "8719706003124", 4800, 4100, 18, "84717020", 2, 36],
        ["CCTV Power Supply 12V 10A (8 ch)", "Power supply", "Generic", "SMPS-12V10A", "", 1100, 900, 18, "85044090", 15, 6],
        ["3+1 Coaxial CCTV Cable 90m", "Cables & accessories", "D-Link", "NCB-CCTV-90M", "", 2200, 1900, 18, "85442010", 6, 0],
        ["BNC Connector (pack of 10)", "Cables & accessories", "Generic", "BNC-10", "", 150, 120, 18, "85366990", 40, 0],
      ];
      for (const [name, categoryName, brand, model, barcode, mrp, price, gstRate, hsn, openingStock, warrantyMonths] of items) {
        const category = (await Category.findOneAndUpdate({ name: categoryName }, {}, { upsert: true, new: true }))!;
        const product = await Product.create({
          name, category: category._id, brand, model, barcode: barcode || undefined, sku: skuCode(await nextSequence("sku")),
          unit: name.includes("Cable") ? "roll" : "pcs", hsn, mrp: toPaise(mrp), price: toPaise(price), costPrice: toPaise(price * 0.8),
          gstRate, lowStockAt: 3, warrantyMonths, stock: openingStock,
        });
        await StockMovement.create({ product: product._id, change: openingStock, balanceAfter: openingStock, reason: "OPENING", note: "Demo data", by: admin._id });
      }
      console.log("Added demo products. Products without a barcode get an AVI-xxxxx SKU.");
    }
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
