/** @type {import("next").NextConfig} */
export default {output:"standalone",reactStrictMode:true,poweredByHeader:false,images:{formats:["image/avif","image/webp"]},async rewrites(){return {beforeFiles:[{source:"/api/:path*",destination:(process.env.API_INTERNAL_URL??"http://127.0.0.1:4000")+"/api/:path*"}]};}};
