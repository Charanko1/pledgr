import { Schema, model, models } from "mongoose";

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      unique: true,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Invitation Code
    code: {
      type: String,
      unique: true,
      required: true,
    },

    treasury: {
      type: Number,
      default: 0,
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Anggota organisasi
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default models.Organization ||
  model("Organization", OrganizationSchema);