"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

// Add indicatorClassName to the props interface
interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}


const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps // Use the updated props interface
>(({ className, value, indicatorClassName, ...props }, ref) => ( // Destructure indicatorClassName
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-1.5 w-full overflow-hidden rounded-full bg-secondary/20 dark:bg-secondary/30", // Lighter background for the track
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      // Apply indicatorClassName using cn, keeping bg-primary as default
      className={cn(
          "h-full w-full flex-1 bg-primary transition-all duration-500 ease-out",
          indicatorClassName // Apply the custom class if provided
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
