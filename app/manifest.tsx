import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drink Tracker",
    short_name: "DrinkTracker",
    description: "Track daily drinks on a calendar.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
  };
}