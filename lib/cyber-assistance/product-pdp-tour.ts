import type { DriveStep } from "driver.js";

import { filterTourSteps } from "@/lib/cyber-assistance/tour-utils";

const PDP_STEPS: DriveStep[] = [
  {
    element: "[data-cyber-guide='pdp-header']",
    popover: {
      title: "Your product",
      description:
        "This is the style you are ordering. Check the name, code, and price here before you configure colours and decoration.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-gallery']",
    popover: {
      title: "Photos",
      description:
        "Browse product images. Thumbnails update the main photo. Colours in step 1 also change the hero image when available.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-colour']",
    popover: {
      title: "1. Colour",
      description: "Pick a colour first. Quantities are saved per colour — you can switch colours without losing sizes you already entered.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-size']",
    popover: {
      title: "2. Size & quantity",
      description:
        "Enter how many you need for each size while this colour is selected. Use the size guide link if you are unsure. Repeat for other colours if needed.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-service']",
    popover: {
      title: "3. Service type",
      description:
        "Plain = no decoration. Embroidery or Print adds your logo on chosen placements. Pricing updates in the total panel as you go.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-placement']",
    popover: {
      title: "4. Placement",
      description:
        "Choose where each decoration goes (e.g. left chest). Pick Embroidery or Print for each position that should carry your logo.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-logo']",
    popover: {
      title: "5. Logo upload",
      description:
        "Upload your artwork (images, PDF, or AI). Files stay in this browser until checkout — add to cart saves the filenames on your order line.",
      side: "left",
      align: "start",
    },
  },
  {
    element: "[data-cyber-guide='pdp-add-to-cart']",
    popover: {
      title: "Add to cart",
      description:
        "Review the live total, then add every colour/size with quantity to your cart. Sign in when prompted to complete checkout later.",
      side: "left",
      align: "end",
    },
  },
];

export function buildProductPdpTourSteps(): DriveStep[] {
  return filterTourSteps(PDP_STEPS);
}
