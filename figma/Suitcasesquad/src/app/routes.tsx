import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { PlanHome } from "./components/stages/plan/PlanHome";
import { Explorer } from "./components/stages/plan/Explorer";
import { AIAssistant } from "./components/stages/AIAssistant";
import { Team } from "./components/stages/Team";
import { Profile } from "./components/stages/Profile";
import { ApprovalHome } from "./components/stages/approval/ApprovalHome";
import { BookingOptimization } from "./components/stages/approval/BookingOptimization";
import { TravelHome } from "./components/stages/travel/TravelHome";
import { CalendarView } from "./components/stages/travel/CalendarView";
import { ReturnHome } from "./components/stages/return/ReturnHome";
import { MemoryBuilder } from "./components/stages/return/MemoryBuilder";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      // Stage 1: Plan
      { index: true, Component: PlanHome },
      { path: "explorer", Component: Explorer },
      { path: "assistant", Component: AIAssistant },
      { path: "team", Component: Team },
      { path: "profile", Component: Profile },

      // Stage 2: Approval
      { path: "approval", Component: ApprovalHome },
      { path: "booking", Component: BookingOptimization },

      // Stage 3: Travel
      { path: "travel", Component: TravelHome },
      { path: "calendar", Component: CalendarView },

      // Stage 4: Return
      { path: "return", Component: ReturnHome },
      { path: "memory", Component: MemoryBuilder },
    ],
  },
]);
