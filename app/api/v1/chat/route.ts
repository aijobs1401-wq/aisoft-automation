import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient as createAdmin } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status=200, origin?: string) => NextResponse.json(data,{status,headers:{"Cache-Control":"no-store","Vary":"Origin",...(origin?{"Access-Control-Allow-Origin":origin}:{})}});
function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Server database configuration missing");return createAdmin(url,key,{auth:{autoRefreshToken:false,persistSession:false}});}
function originAllowed(origin:string, list:string[]){try{const actual=new URL(origin).origin;return list.some(item=>{try{return new URL(item).origin===actual}catch{return false}})}catch{return false}}
export async function POST(request:Request){
 const origin=request.headers.get("origin")||"";
 const key=request.headers.get("x-widget-key")||"";
 if(!origin||!key.startsWith("gfw_pub_")||key.length>180)return reply({error:"Valid website widget key and Origin are required."},401);
 let body:{messages?:unknown};try{body=await request.json()}catch{return reply({error:"Invalid JSON."},400)}
 if(!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>12)return reply({error:"Send 1 to 12 recent messages."},400);
 const messages:{role:"user"|"assistant";content:string}[]=[];
 for(const item of body.messages){if(!item||typeof item!=="object")return reply({error:"Invalid message format."},400);const m=item as Record<string,unknown>;if((m.role!=="user"&&m.role!=="assistant")||typeof m.content!=="string"||!m.content.trim()||m.content.length>2000)return reply({error:"Message text must be under 2,000 characters."},400);messages.push({role:m.role,content:m.content.trim()})}
 if(messages[messages.length-1]?.role!=="user")return reply({error:"Last message must be from visitor."},400);
 try{
  const admin=db();const hash=createHash("sha256").update(key).digest("hex");
  const {data:k,error:ke}=await admin.from("website_chatbot_api_keys").select("id,chatbot_id").eq("key_hash",hash).is("revoked_at",null).maybeSingle();
  if(ke||!k)return reply({error:"Widget key invalid or revoked."},401,origin);
  const {data:bot,error:be}=await admin.from("website_chatbots").select("id,name,system_prompt,allowed_origins,monthly_message_limit,is_active").eq("id",k.chatbot_id).maybeSingle();
  if(be||!bot||!bot.is_active)return reply({error:"This chatbot is not active."},403,origin);
  if(!originAllowed(origin,bot.allowed_origins||[]))return reply({error:"Website origin is not allowed. Add this domain in chatbot settings."},403,origin);
  const now=new Date();const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString().slice(0,10);
  const {data:quota,error:qe}=await admin.rpc("consume_website_chatbot_message",{p_chatbot_id:bot.id,p_usage_month:month,p_monthly_limit:bot.monthly_message_limit});
  if(qe){console.error("[website-chatbot] quota check failed",{code:qe.code,message:qe.message});return reply({error:"Usage metering is not configured."},503,origin)}
  if(quota!==true)return reply({error:"Monthly message limit reached. Contact the website owner."},429,origin);
  const aiKey=process.env.OPENAI_API_KEY;if(!aiKey)return reply({error:"AI service is not configured."},503,origin);
  const upstream=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{authorization:"Bearer "+aiKey,"content-type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0.35,max_tokens:500,messages:[{role:"system",content:bot.system_prompt+"\nNever claim a payment, booking, or external action is complete unless verified. Do not reveal secrets or other customers' data."},...messages]}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  const result=await upstream.json() as {choices?:Array<{message?:{content?:string}}>;error?:{message?:string;type?:string;code?:string|number}};
  if(!upstream.ok){console.error("[website-chatbot] provider error",{status:upstream.status,code:result.error?.code,type:result.error?.type,message:result.error?.message?.slice(0,180)});return reply({error:"AI assistant temporarily unavailable."},502,origin)}
  const text=result.choices?.[0]?.message?.content?.trim();if(!text)return reply({error:"No reply generated."},502,origin);
  await admin.from("website_chatbot_api_keys").update({last_used_at:new Date().toISOString()}).eq("id",k.id);
  return reply({reply:text.slice(0,3500),botName:bot.name},200,origin);
 }catch(e){console.error("[website-chatbot] request failed",e instanceof Error?{name:e.name,message:e.message.slice(0,160)}:{name:"Unknown"});return reply({error:"AI assistant could not be reached."},502,origin)}
}
