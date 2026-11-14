package com.xdutsuay.shatrunz;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * #32: serves the one exported GIF to the app picked in the share sheet.
 * A 40-line read-only provider instead of pulling in androidx FileProvider.
 * Only cache/share/game.gif is ever served, and only to apps granted the URI.
 */
public final class GifShareProvider extends ContentProvider {
    private static final String NAME = "game.gif";

    static File writeShared(Context ctx, byte[] bytes) {
        File dir = new File(ctx.getCacheDir(), "share");
        if (!dir.isDirectory() && !dir.mkdirs()) return null;
        File f = new File(dir, NAME);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(bytes);
            return f;
        } catch (IOException e) {
            return null;
        }
    }

    static Uri uriFor(Context ctx, File f) {
        return Uri.parse("content://" + ctx.getPackageName() + ".gifshare/" + NAME);
    }

    private File file() {
        return new File(new File(getContext().getCacheDir(), "share"), NAME);
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) { return "image/gif"; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!NAME.equals(uri.getLastPathSegment())) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file(), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] args, String sort) {
        MatrixCursor c = new MatrixCursor(new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[] {"shatrunz.gif", file().length()});
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
