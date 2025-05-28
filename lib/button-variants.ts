import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
        gradient: "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export const iconButtonVariants = cva(
  "rounded-full transition-all duration-200 flex items-center justify-center",
  {
    variants: {
      variant: {
        ghost: "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-600",
        destructive: "text-red-400 hover:text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:text-red-300 dark:hover:bg-red-900/20",
        primary: "text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300",
      },
      size: {
        sm: "p-1 w-6 h-6",
        default: "p-1.5 w-8 h-8",
        lg: "p-2 w-10 h-10",
      },
      visibility: {
        always: "opacity-100",
        hover: "opacity-0 group-hover:opacity-100",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
      visibility: "always",
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type IconButtonVariants = VariantProps<typeof iconButtonVariants>; 