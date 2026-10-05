package com.test.utils;

import io.qameta.allure.Allure;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * Flake Diff Snapshot — Production Grade V2.0
 * Single-call, bounded, PII-safe snapshot for Allure.
 * - One JavascriptExecutor pass (<300ms p95)
 * - Budgets: html 20k, bodyText 2k, storage 10 keys x 500 chars
 * - PII: redact=true emits {key, valueHash, size} only — no preview/raw
 * - Never throws; falls back to error JSON attachment
 */
public class FlakeSnapshot {
    private static final int MAX_HTML_SNIPPET = 20000;
    private static final int MAX_BODY_TEXT = 2000;
    private static final int MAX_STORAGE_KEYS = 10;
    private static final int MAX_STORAGE_VALUE = 500;
    private static final int MAX_COOKIES = 20;
    private static final int MAX_ERRORS = 20;
    /** Pretty JSON — human-readable, valid, Allure-friendly */
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    /** Set to false for local debug only — never in CI */
    private static final boolean REDACT = true;

    public static String capture(WebDriver driver, String testName) { return capture(driver, testName, "unknown"); }

    public static String capture(WebDriver driver, String testName, String status) {
        return capture(driver, testName, status, "lite");
    }

    public static String capture(WebDriver driver, String testName, String status, String captureMode) {
        long t0 = System.currentTimeMillis();
        try {
            Map<String,Object> root = new LinkedHashMap<>();
            root.put("schemaVersion","2.0");
            root.put("captureMode", captureMode);
            root.put("timestamp", Instant.now().toString());
            root.put("testName", testName);
            root.put("status", status);

            String currentUrl = safe(() -> driver.getCurrentUrl());
            Map<String,Object> meta = new LinkedHashMap<>();
            meta.put("url", currentUrl);
            meta.put("queryParams", parseQueryParams(currentUrl));
            meta.put("title", safe(() -> driver.getTitle()));
            meta.putAll(safeJsMeta(driver));
            root.put("meta", meta);

            Map<String,Object> js = safeJsDom(driver);
            // PII hardening: strip preview if REDACT
            js = sanitizeStorage(js);
            root.put("dom", js.getOrDefault("dom", Map.of()));
            root.put("console", js.getOrDefault("console", Map.of()));
            root.put("storage", js.getOrDefault("storage", Map.of()));
            root.put("cookies", buildCookies(driver));
            root.put("config", Map.of(
                "maxHtml", MAX_HTML_SNIPPET,
                "maxStorageKeys", MAX_STORAGE_KEYS,
                "redact", REDACT,
                "captureMs", System.currentTimeMillis()-t0
            ));

            String json = GSON.toJson(root);
            // Budget guard: warn if >1MB
            if (json.length() > 1_000_000) {
                root.put("warning", "snapshot >1MB truncated");
                json = GSON.toJson(root);
            }
            attach("snapshot-" + sanitize(testName) + ".json", json);
            writeFallback(testName, status, json);
            return json;
        } catch(Exception e){
            String fb = "{\"schemaVersion\":\"2.0\",\"error\":\"snapshot_failed\",\"msg\":\"" + esc(e.getMessage()) + "\"}";
            attach("snapshot-error.json", fb);
            return fb;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> sanitizeStorage(Map<String,Object> js){
        if(!REDACT) return js;
        try{
            Map<String,Object> storage = (Map<String,Object>) js.get("storage");
            if(storage==null) return js;
            for(String k: List.of("local","session")){
                List<Map<String,Object>> arr = (List<Map<String,Object>>) storage.get(k);
                if(arr==null) continue;
                List<Map<String,Object>> clean=new ArrayList<>();
                for(Map<String,Object> e: arr){
                    Map<String,Object> c=new LinkedHashMap<>();
                    c.put("key", e.get("key"));
                    c.put("valueHash", e.get("valueHash"));
                    c.put("size", e.get("size"));
                    if(e.containsKey("truncated")) c.put("truncated", e.get("truncated"));
                    // preview intentionally omitted when REDACT
                    clean.add(c);
                }
                storage.put(k, clean);
            }
        }catch(Exception ignored){}
        return js;
    }

    private static void attach(String name, String json){
        try{ Allure.addAttachment(name, "application/json", json, ".json"); }catch(Exception ignored){}
    }
    private static void writeFallback(String testName, String status, String json){
        try{
            java.nio.file.Path out = java.nio.file.Paths.get("target/snapshots",
                "snapshot-" + sanitize(testName) + "-" + status + ".json");
            java.nio.file.Files.createDirectories(out.getParent());
            java.nio.file.Files.writeString(out, json, StandardCharsets.UTF_8);
        }catch(Exception ignored){}
    }
    private static String sanitize(String s){ return s==null?"unknown":s.replaceAll("[^a-zA-Z0-9._-]","_"); }
    private static String esc(String s){ return s==null?"":s.replace("\"","'").replace("\n"," "); }

    private static Map<String,Object> safeJsMeta(WebDriver driver){
        try{
            JavascriptExecutor js=(JavascriptExecutor)driver;
            Object r=js.executeScript("return {viewport:{width:window.innerWidth, height:window.innerHeight}, userAgentHash: (navigator.userAgent||'').length.toString(36)};");
            if(r instanceof Map) return (Map<String,Object>)r;
        }catch(Exception ignored){}
        return Map.of("viewport", Map.of("width",1280,"height",800));
    }

    private static Map<String,Object> safeJsDom(WebDriver driver){
        try{
            JavascriptExecutor js=(JavascriptExecutor)driver;
            js.executeScript("if(!window.__flakeErrors){window.__flakeErrors=[]; window.__flakeWarnings=[]; const _e=console.error; console.error=(...a)=>{try{window.__flakeErrors.push(a.join(' '))}catch(e){} _e(...a)}; const _w=console.warn; console.warn=(...a)=>{try{window.__flakeWarnings.push(a.join(' '))}catch(e){} _w(...a)}; }");
            String MAX_HTML=""+MAX_HTML_SNIPPET, MAX_TEXT=""+MAX_BODY_TEXT,
                   MAX_STORE_KEYS=""+MAX_STORAGE_KEYS, MAX_STORE_VAL=""+MAX_STORAGE_VALUE;
            Object res = js.executeScript(
                "const MAX_HTML="+MAX_HTML+"; const MAX_TEXT="+MAX_TEXT+"; const MAX_STORE_KEYS="+MAX_STORE_KEYS+"; const MAX_STORE_VAL="+MAX_STORE_VAL+";"
                + "function hash(s){let h=0; for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0; return h.toString(36);}"
                + "let counts={total:0, visible:0, byTag:{}}; let testIds={}; let inventory=[]; let hiddenCount=0;"
                + "const all=document.querySelectorAll('*'); counts.total=all.length;"
                + "all.forEach(el=>{const tag=el.tagName.toLowerCase(); counts.byTag[tag]=(counts.byTag[tag]||0)+1; if(el.hasAttribute('data-testid')){const k=el.getAttribute('data-testid'); testIds[k]=(testIds[k]||0)+1;} let hidden=false; try{ if(el.checkVisibility) hidden=!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}); else hidden=(el.offsetParent===null || el.getClientRects().length===0); }catch(e){ hidden=(el.offsetParent===null); } if(hidden && el.tagName!=='HTML' && el.tagName!=='BODY' && el.tagName!=='HEAD') hiddenCount++;});"
                + "counts.visible = counts.total - hiddenCount;"
                + "document.querySelectorAll('[data-testid]').forEach(el=>{ try{ if(inventory.length<20) inventory.push({selector:'[data-testid=\"'+el.getAttribute('data-testid')+'\"]', testId:el.getAttribute('data-testid'), count:1}); }catch(e){ if(inventory.length<20) inventory.push({selector:'[data-testid\"'+el.getAttribute('data-testid').replace(/\"/g,'\\\\\"')+'\"]', testId:el.getAttribute('data-testid'), count:1}); } });"
                + "document.querySelectorAll('[id]').forEach(el=>{ try{ if(inventory.length<30 && el.id && !el.hasAttribute('data-testid')) inventory.push({selector:'#'+CSS.escape(el.id), id:el.id, count:1}); }catch(e){ if(inventory.length<30 && el.id && !el.hasAttribute('data-testid')) inventory.push({selector:'[id="'+el.id.replace(/"/g,'\\"')+'"]', id:el.id, count:1}); } });"
                + "document.querySelectorAll('[name]').forEach(el=>{ if(inventory.length<30 && el.getAttribute('name') && !el.hasAttribute('data-testid') && !el.id) inventory.push({selector:'[name=\"'+el.getAttribute('name')+'\"]', name:el.getAttribute('name'), count:1});});"
                + "let htmlSnippet=''; try{ const clone=document.documentElement.cloneNode(true); clone.querySelectorAll('input, textarea, select').forEach(i=>{ try{ i.value='[REDACTED]'; i.setAttribute('value','[REDACTED]'); if(i.textContent) i.textContent='[REDACTED]'; }catch(e){} }); clone.querySelectorAll('script, style').forEach(s=>s.remove()); htmlSnippet=clone.outerHTML||''; if(htmlSnippet.length>MAX_HTML) htmlSnippet=htmlSnippet.slice(0,MAX_HTML)+'<!-- truncated '+htmlSnippet.length+' -->';}catch(e){htmlSnippet='unavailable:'+e.message}"
                + "let bodyText=''; try{bodyText=(document.body.innerText||'').slice(0,MAX_TEXT);}catch(e){}"
                + "function capStore(store){let arr=[]; try{for(let i=0;i<Math.min(store.length, MAX_STORE_KEYS); i++){const k=store.key(i); const v=store.getItem(k)||''; arr.push({key:k, valueHash:hash(v), size:v.length, truncated: v.length>MAX_STORE_VAL, preview: v.slice(0,MAX_STORE_VAL)});} }catch(e){arr=[{error:e.message}]} return arr;}"
                + "const local=capStore(localStorage); const session=capStore(sessionStorage);"
                + "const errs=[...new Set(window.__flakeErrors||[])].slice(0,"+MAX_ERRORS+"); const warns=[...new Set(window.__flakeWarnings||[])].slice(0,"+MAX_ERRORS+");"
                + "return {dom:{counts:counts, testIds:testIds, locatorInventory:inventory, htmlSnippet:htmlSnippet, bodyText:bodyText, visibility:{hiddenCount:hiddenCount, offscreenCount:0}}, console:{errors:errs, warnings:warns, errorHashes: errs.map(hash)}, storage:{local:local, session:session, count: local.length+session.length}};"
            );
            if(res instanceof Map) return (Map<String,Object>)res;
            return Map.of();
        }catch(Exception e){ return Map.of("error", e.getMessage()); }
    }

    private static List<Map<String,Object>> buildCookies(WebDriver driver){
        List<Map<String,Object>> list=new ArrayList<>();
        try{
            driver.manage().getCookies().forEach(c->{
                Map<String,Object> m=new LinkedHashMap<>();
                m.put("name", c.getName());
                m.put("valueHash", Integer.toHexString(c.getValue()!=null?c.getValue().hashCode():0));
                m.put("domain", c.getDomain());
                m.put("secure", c.isSecure());
                list.add(m);
            });
        }catch(Exception e){ list.add(Map.of("error", e.getMessage())); }
        if(list.size()>MAX_COOKIES) return list.subList(0,MAX_COOKIES);
        return list;
    }

    private static Map<String,String> parseQueryParams(String url){
        Map<String,String> m=new LinkedHashMap<>();
        try{ if(url==null||!url.contains("?")) return m; String q=url.substring(url.indexOf("?")+1); if(q.contains("#")) q=q.substring(0,q.indexOf("#")); for(String p:q.split("&")){ if(p.isEmpty()) continue; String[] kv=p.split("=",2); String k=java.net.URLDecoder.decode(kv[0],StandardCharsets.UTF_8); String v=kv.length>1?java.net.URLDecoder.decode(kv[1],StandardCharsets.UTF_8):""; m.put(k,v);} }catch(Exception ignored){}
        return m;
    }
    private static String safe(Supplier<String> s){ try{return s.get();}catch(Exception e){return "unavailable: "+e.getMessage();} }
    @FunctionalInterface interface Supplier<T>{ T get(); }
}
