package ci.moayes.gestion;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * MOAYÉ'S Gestion Pro — application Android.
 * Elle affiche la version en ligne (GitHub Pages) : chaque mise à jour publiée
 * sur GitHub arrive donc toute seule, sans réinstaller l'APK.
 * Le pont « AndroidBridge » ajoute ce qu'un navigateur fait seul :
 * enregistrer un fichier, imprimer, ouvrir WhatsApp.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "https://moayeindustrie.github.io/moayes-gestion/";
    private static final String APP_HOST = "moayeindustrie.github.io";
    private static final int REQ_FILE = 41;
    private static final int REQ_STORAGE = 42;

    private WebView web;
    private WebView printView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingName, pendingMime, pendingData;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#173f2f"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#eef2ed"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " MoayesApp/2.5");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (("https".equals(scheme) || "http".equals(scheme)) && APP_HOST.equals(u.getHost())) return false;
                if ("file".equals(scheme)) return false;
                openExternal(u.toString());
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                view.getSettings().setAllowFileAccess(url != null && url.startsWith("file:///android_asset/"));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                String t = (types != null && types.length > 0 && types[0] != null && !types[0].isEmpty()) ? types[0] : "*/*";
                if (t.startsWith(".") || t.contains(",")) t = "*/*";
                i.setType(t);
                try {
                    startActivityForResult(Intent.createChooser(i, "Choisir un fichier"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    toast("Aucune application pour choisir un fichier");
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(APP_URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] res = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) res = new Uri[]{data.getData()};
        fileCallback.onReceiveValue(res);
        fileCallback = null;
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        String url = web.getUrl();
        if (url != null && url.startsWith("file:///android_asset/")) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.__back ? window.__back() : false)", v -> {
            if (!"true".equals(v)) {
                if (web.canGoBack()) web.goBack(); else finish();
            }
        });
    }

    /* ---------- actions demandées par la page ---------- */

    private void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            toast("Aucune application pour ouvrir ce lien");
        }
    }

    private void saveFile(String name, String mime, String b64) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingName = name; pendingMime = mime; pendingData = b64;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MOAYES");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("insert");
                try (OutputStream os = getContentResolver().openOutputStream(uri)) { os.write(bytes); }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "MOAYES");
                if (!dir.exists()) dir.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(new File(dir, name))) { fos.write(bytes); }
            }
            toast("Enregistré dans Téléchargements/MOAYES : " + name);
        } catch (Exception e) {
            toast("Impossible d'enregistrer le fichier");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_STORAGE && pendingData != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) saveFile(pendingName, pendingMime, pendingData);
            else toast("Autorisation refusée : fichier non enregistré");
            pendingName = pendingMime = pendingData = null;
        }
    }

    private void printHtml(String html, String title) {
        printView = new WebView(this);
        printView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String job = (title == null || title.isEmpty()) ? "MOAYES" : title;
                PrintDocumentAdapter ad = view.createPrintDocumentAdapter(job);
                pm.print(job, ad, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            }
        });
        printView.loadDataWithBaseURL(APP_URL, html, "text/html", "UTF-8", null);
    }

    private void shareFile(String name, String mime, String b64) {
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            File dir = new File(getCacheDir(), "partage");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, name);
            try (FileOutputStream fos = new FileOutputStream(f)) { fos.write(bytes); }
            Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fichiers", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.putExtra(Intent.EXTRA_SUBJECT, name);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, "Envoyer la sauvegarde vers…"));
        } catch (Exception e) {
            saveFile(name, mime, b64);
        }
    }

    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }

    /* ---------- pont appelé depuis la page ---------- */
    private class Bridge {
        @JavascriptInterface public void saveFile(String name, String mime, String b64) { runOnUiThread(() -> MainActivity.this.saveFile(name, mime, b64)); }
        @JavascriptInterface public void shareFile(String name, String mime, String b64) { runOnUiThread(() -> MainActivity.this.shareFile(name, mime, b64)); }
        @JavascriptInterface public void openExternal(String url) { runOnUiThread(() -> MainActivity.this.openExternal(url)); }
        @JavascriptInterface public void printHtml(String html, String title) { runOnUiThread(() -> MainActivity.this.printHtml(html, title)); }
        @JavascriptInterface public void reload() { runOnUiThread(() -> web.loadUrl(APP_URL)); }
        @JavascriptInterface public String version() { return "2.5"; }
    }
}
