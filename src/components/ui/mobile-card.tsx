import * as React from "react"
import { cn } from "@/lib/utils"

// Componente de tarjeta optimizado para móviles
const MobileCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm w-full mx-auto",
      className
    )}
    {...props}
  />
))
MobileCard.displayName = "MobileCard"

// Encabezado de tarjeta con padding reducido para móviles
const MobileCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-3 sm:p-4", className)}
    {...props}
  />
))
MobileCardHeader.displayName = "MobileCardHeader"

// Título de tarjeta con tamaño de texto reducido para móviles
const MobileCardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
      className
    )}
    {...props}
  />
))
MobileCardTitle.displayName = "MobileCardTitle"

// Descripción de tarjeta optimizada para móviles
const MobileCardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs sm:text-sm text-muted-foreground", className)}
    {...props}
  />
))
MobileCardDescription.displayName = "MobileCardDescription"

// Contenido de tarjeta con padding reducido para móviles
const MobileCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-3 pt-0 sm:p-4 sm:pt-0", className)} {...props} />
))
MobileCardContent.displayName = "MobileCardContent"

// Pie de tarjeta con padding reducido para móviles
const MobileCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-3 pt-0 sm:p-4 sm:pt-0", className)}
    {...props}
  />
))
MobileCardFooter.displayName = "MobileCardFooter"

export { 
  MobileCard, 
  MobileCardHeader, 
  MobileCardFooter, 
  MobileCardTitle, 
  MobileCardDescription, 
  MobileCardContent 
}
