import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { PlanningProvider } from "./context/PlanningContext";

export default function App() {
  return (
    <PlanningProvider>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </PlanningProvider>
  );
}