"use client";
import BrandFeedback from "@/shared/ui/brand-feedback";
import {useRouter} from "next/navigation";
export default function ErrorPage({reset}:{reset:()=>void}) {const router=useRouter();return <BrandFeedback kind="error" onRetry={()=>{reset();router.refresh();}}/>;}
