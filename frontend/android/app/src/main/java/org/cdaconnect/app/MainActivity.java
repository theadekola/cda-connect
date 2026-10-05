package org.cdaconnect.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(CdaDevicePlugin.class);
        super.onCreate(savedInstanceState);
        // Disable Android's edge stretch for the whole WebView, including fixed navigation.
        if (getBridge() != null) {
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
