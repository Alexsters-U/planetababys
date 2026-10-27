"use client";
import BrandFeedback from "@/shared/ui/brand-feedback";
import {useRouter} from "next/navigation";
export default function AdminError({reset}:{reset:()=>void}) {const router=useRouter();return <BrandFeedback kind="admin" onRetry={()=>{reset();router.refresh();}}/>;}
