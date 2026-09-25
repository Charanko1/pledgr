import mongoose, { Schema, models } from "mongoose";

const GroupSchema = new Schema(
  {
    // =======================
    // BASIC
    // =======================
    name: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    // =======================
    // ORGANIZATION
    // =======================
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    organizationSlug: {
      type: String,
      required: true,
    },

    organizationName: {
      type: String,
      required: true,
    },

    // =======================
    // LEADER
    // =======================
    leader: {
      type: String,
      required: true,
    },

    leaderId: {
      type: String,
      required: true,
    },

    // =======================
    // MEMBER COUNT
    // =======================
    members: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export default models.Group || mongoose.model("Group", GroupSchema);