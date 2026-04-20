import { Users } from "lucide-react";

export function EmployeesPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold text-foreground">
        People Directory
      </h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Employee assessments, development plans, and team analytics will appear
        here.
      </p>
    </div>
  );
}
