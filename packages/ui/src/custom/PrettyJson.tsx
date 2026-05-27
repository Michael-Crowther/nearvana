import { Card } from "../components/card";
import { cn } from "../lib/utils";

export type PrettyJsonProps = {
  className?: string;
  children?: unknown;
};

export function PrettyJson({ className, children }: PrettyJsonProps) {
  return (
    <Card
      className={cn(
        "border-primary p-3 m-3 font-mono whitespace-pre-wrap bg-blue-50",
        className
      )}
    >
      {JSON.stringify(children, null, "\t")}
    </Card>
  );
}
