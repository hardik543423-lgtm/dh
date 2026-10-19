import { z } from "zod";

export const orderPlacementSchema = z.object({
  broker_id_str: z.string({ required_error: "broker_id_str is required" }).min(1),
  customer_id_str: z.string({ required_error: "customer_id_str is required" }).min(1),
  instrument_token: z.union([z.string(), z.number()]).transform(String),
  symbol: z.string({ required_error: "symbol is required" }).min(1),
  side: z.enum(["BUY", "SELL"], { required_error: "side must be BUY or SELL" }),
  product: z.enum(["MIS", "NRML", "CNC", "CO", "BO"], { required_error: "product is invalid" }),
  price: z.coerce.number().nonnegative().default(0),
  quantity: z.coerce.number().positive("Quantity must be a positive number"),
  lot_size: z.coerce.number().positive().default(1),
  lots: z.coerce.number().positive().optional(),
  segment: z.string().default("UNKNOWN"),
  jobbin_price: z.coerce.number().nonnegative("Jobbing price must be non-negative").default(0),
  jobbin_type: z.enum(["percentage", "points"]).default("percentage"),
  came_From: z.string().optional()
}).passthrough(); // Allow extra fields like meta, stop_loss, target to pass through

export const orderUpdateSchema = z.object({
  order_id: z.string({ required_error: "order_id is required" }).min(1),
  quantity: z.coerce.number().positive().optional(),
  lots: z.coerce.number().positive().optional(),
  price: z.coerce.number().nonnegative().optional(),
  order_status: z.string().optional(),
  closed_ltp: z.coerce.number().nonnegative().optional(),
  stop_loss: z.coerce.number().nonnegative().optional(),
  target: z.coerce.number().nonnegative().optional(),
  jobbing_point: z.coerce.number().optional()
}).passthrough();
