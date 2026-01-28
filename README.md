# Remote DJ server

Just a quickly vibe-coded web server and interface that provides basic control over Auto DJ decks in Mixxx DJ tool via HTTP.

## But why...

I ran a party and needed some music player that:

* plays music,
* implements playlist feature,
* provides control over next/previous track and timepoint of currently played track,
* does more sophisticated smooth transitions between tracks (maybe even with matching drum beat),
* can be controlled remotely in case of need.

It took me a while to realize why there is nothing FOSS available in the web that fulfills each need.

> ...everyone is using Spotify, you old fart.

But making one was quite a fun and IMHO - using Mixxx combined with the remote UI creates way better UX than some modern apps, and of course - why not.

## How to?

Everything that I describe here was done on Debian Linux Trixie - you can try to run it on other OSs but Windows and Mac probably will need some adjustments.

1. Install Mixxx software and Nodejs.
2. Copy WebRemote.mid.xml to `~/.mixxx/controllers/`.
3. Open port 8787 on your local computer firewall.
4. Run `npm install` in repo to install dependencies.
5. Run `node server.js`.
6. Run Mixxx software - important - you must run it after server.
7. Enable `MixxxWebRemote MIDI` controller in preferences.
8. Apply `WebRemote AutoDJ` mapping to the controller.
9. Run AutoDJ with some music and run `http://{your-ip}:8787` in the browser.
10. Let's go.

## Features

1. Music volume - you may want to adjust it immediately - you've got the slider.
2. Transition - makes smooth transition to the next track on the queue.
3. Skip next track - removes next track from the queue.
4. Queue - first 20 tracks from the auto DJ queue.
5. Forward / backward - move 1 beat forward / backward on the deck.

