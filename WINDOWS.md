## Requirements for Windows

- **Virtual MIDI**: Windows doesn't support virtual ports natively. Install loopMIDI and create a port named MixxxWebRemote.
- **Mixxx Database Path**: The script needs to point to %LOCALAPPDATA%\Mixxx\mixxxdb.sqlite instead of the Linux .mixxx folder.
- **Mapping Installation**: On Windows, the .midi.xml and .js mapping files must be placed in C:\Program Files\Mixxx\controllers.


### Verification Checklist

- loopMIDI: Ensure you have it running and a port named MixxxWebRemote is active.
- Controller Folder: Copy the WebRemote.mid.xml and WebRemote.js (if it exists) to C:\Program Files\Mixxx\controllers.
- Mixxx Preferences: Enable the MixxxWebRemote controller in Mixxx and select the mapping file.
