"use client";

import { Camera, Eye, PenLine, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { usernameChangeAvailableAt, validateBio, validateDisplayName } from "@/lib/profile";
import { validateUsernameFormat } from "@/lib/username";
import styles from "./profile.module.css";

type ProfileEditorProps = {
  userId: string;
  username: string;
  displayName: string;
  storedDisplayName: string | null;
  bio: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  usernameChangedAt: string | null;
};

async function cropAvatar(source: string, zoom: number, horizontal: number, vertical: number) {
  const image = new Image();
  image.src = source;
  await image.decode();

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = Math.max(0, image.naturalWidth - cropSize);
  const maxY = Math.max(0, image.naturalHeight - cropSize);
  const sourceX = ((horizontal + 100) / 200) * maxX;
  const sourceY = ((vertical + 100) / 200) * maxY;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image processing failed."))),
      "image/webp",
      0.86,
    );
  });
}

export function ProfileEditor(props: ProfileEditorProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [pending, setPending] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(props.storedDisplayName ?? "");
  const [bio, setBio] = useState(props.bio);
  const [nextUsername, setNextUsername] = useState("");

  const availableAt = usernameChangeAvailableAt(props.usernameChangedAt);
  const usernameLocked = Boolean(availableAt && availableAt.getTime() > renderedAt);

  async function saveProfile() {
    const displayValidation = validateDisplayName(displayName);
    const bioValidation = validateBio(bio);
    if (!displayValidation.valid || !bioValidation.valid) {
      setMessage(displayValidation.message || bioValidation.message);
      return;
    }

    setPending(true);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("update_my_profile", {
      new_display_name: displayValidation.value,
      new_bio: bioValidation.value,
    });
    setPending(false);
    if (error) {
      setMessage(error.message || "Profile changes couldn’t be saved.");
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  async function changeUsername() {
    const validation = validateUsernameFormat(nextUsername);
    if (!validation.valid) {
      setMessage(validation.message);
      return;
    }
    setPending(true);
    setMessage("");
    const { error } = await getSupabaseBrowserClient().rpc("change_my_username", {
      candidate: nextUsername,
    });
    setPending(false);
    if (error) {
      setMessage(error.message || "Username couldn’t be changed.");
      return;
    }
    setUsernameOpen(false);
    router.refresh();
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image no larger than 5 MB.");
      return;
    }
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(URL.createObjectURL(file));
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setMenuOpen(false);
  }

  async function uploadAvatar() {
    if (!cropSource) return;
    setPending(true);
    setMessage("");
    try {
      const blob = await cropAvatar(cropSource, zoom, horizontal, vertical);
      const supabase = getSupabaseBrowserClient();
      const nextPath = `${props.userId}/avatar-${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(nextPath, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase.rpc("set_my_avatar", {
        new_avatar_path: nextPath,
      });
      if (profileError) {
        await supabase.storage.from("avatars").remove([nextPath]);
        throw profileError;
      }
      if (props.avatarPath) await supabase.storage.from("avatars").remove([props.avatarPath]);
      URL.revokeObjectURL(cropSource);
      setCropSource(null);
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message || "The profile picture couldn’t be saved.");
    } finally {
      setPending(false);
    }
  }

  async function removeAvatar() {
    if (!props.avatarPath) return;
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { error: storageError } = await supabase.storage
      .from("avatars")
      .remove([props.avatarPath]);
    const { error: profileError } = await supabase.rpc("set_my_avatar", {
      new_avatar_path: null,
    });
    setPending(false);
    setMenuOpen(false);
    if (storageError || profileError) {
      setMessage("The profile picture couldn’t be removed. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className={styles.identity}>
        <div className={styles.avatarControl}>
          <button
            className={styles.avatarButton}
            type="button"
            aria-label="Profile picture options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Avatar name={props.displayName} imageUrl={props.avatarUrl} size="large" />
            <span className={styles.cameraBadge}>
              <Camera aria-hidden="true" />
            </span>
          </button>
          {menuOpen ? (
            <div className={styles.avatarMenu}>
              {props.avatarUrl ? (
                <button type="button" onClick={() => setViewOpen(true)}>
                  <Eye aria-hidden="true" /> View profile picture
                </button>
              ) : null}
              <button type="button" onClick={() => fileInput.current?.click()}>
                <Upload aria-hidden="true" /> Change profile picture
              </button>
              {props.avatarPath ? (
                <button type="button" className={styles.dangerText} onClick={removeAvatar}>
                  <Trash2 aria-hidden="true" /> Remove profile picture
                </button>
              ) : null}
            </div>
          ) : null}
          <input
            ref={fileInput}
            className={styles.hiddenInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>
        <div className={styles.identityCopy}>
          <span className={styles.nameRow}>
            <h2>{props.displayName}</h2>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Edit profile"
              onClick={() => setEditOpen(true)}
            >
              <PenLine aria-hidden="true" />
            </button>
          </span>
          <span className={styles.handle}>@{props.username}</span>
          {props.bio ? (
            <p className={styles.bio}>{props.bio}</p>
          ) : (
            <p className={styles.bio}>Add a bio.</p>
          )}
          <button
            className={styles.textButton}
            type="button"
            disabled={usernameLocked}
            onClick={() => setUsernameOpen(true)}
          >
            {usernameLocked && availableAt
              ? `Username change available ${availableAt.toLocaleDateString()}`
              : "Change username"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={styles.inlineMessage} role="alert">
          {message}
        </p>
      ) : null}

      {editOpen ? (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={() => setEditOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="edit-profile-title">Edit profile</h2>
              <button type="button" aria-label="Close" onClick={() => setEditOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>
            <label>
              Display name
              <input
                value={displayName}
                maxLength={20}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <small>Letters and numbers only. Leave blank to use your username.</small>
            </label>
            <label>
              Bio <span>{bio.length}/60</span>
              <textarea
                value={bio}
                maxLength={60}
                rows={3}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>
            <Button fullWidth disabled={pending} onClick={saveProfile}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </section>
        </div>
      ) : null}

      {usernameOpen ? (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={() => setUsernameOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-username-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="change-username-title">Change username</h2>
              <button type="button" aria-label="Close" onClick={() => setUsernameOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>
            <p>
              Your old username stays reserved for 30 days. You cannot change again for 90 days.
            </p>
            <label>
              New username
              <input
                value={nextUsername}
                maxLength={20}
                autoComplete="username"
                onChange={(event) => setNextUsername(event.target.value)}
              />
            </label>
            <Button fullWidth disabled={pending} onClick={changeUsername}>
              {pending ? "Changing…" : "Confirm username"}
            </Button>
          </section>
        </div>
      ) : null}

      {viewOpen && props.avatarUrl ? (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={() => setViewOpen(false)}
        >
          <section
            className={`${styles.modal} ${styles.imageModal}`}
            role="dialog"
            aria-modal="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.avatarUrl} alt={`${props.displayName}'s profile`} />
          </section>
        </div>
      ) : null}

      {cropSource ? (
        <div className={styles.modalLayer} role="presentation">
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-title"
          >
            <header>
              <h2 id="crop-title">Adjust profile picture</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  URL.revokeObjectURL(cropSource);
                  setCropSource(null);
                }}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={styles.cropPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropSource}
                alt="Profile picture preview"
                style={{
                  transform: `scale(${zoom})`,
                  objectPosition: `${(horizontal + 100) / 2}% ${(vertical + 100) / 2}%`,
                }}
              />
            </div>
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <label>
              Left / right
              <input
                type="range"
                min="-100"
                max="100"
                value={horizontal}
                onChange={(event) => setHorizontal(Number(event.target.value))}
              />
            </label>
            <label>
              Up / down
              <input
                type="range"
                min="-100"
                max="100"
                value={vertical}
                onChange={(event) => setVertical(Number(event.target.value))}
              />
            </label>
            <Button fullWidth disabled={pending} onClick={uploadAvatar}>
              {pending ? "Processing…" : "Use this picture"}
            </Button>
          </section>
        </div>
      ) : null}
    </>
  );
}
