import mongoose, { Schema, models } from "mongoose";

const MembershipSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    userId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    walletAddress: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["Admin", "Validator", "Member"],
      default: "Member",
    },
  },
  { timestamps: true }
);

// Satu user hanya boleh join sekali dalam satu organisasi
MembershipSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true }
);

export default models.Membership ||
  mongoose.model("Membership", MembershipSchema);