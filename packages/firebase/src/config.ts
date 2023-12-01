import type { VendorConfiguration } from 'sanity-plugin-external-files'
import { LockIcon, LinkIcon } from '@sanity/icons'
import getFirebaseClient, { FirebaseCredentials } from './getFirebaseClient'

// @TODO: plugin config
const { defaultAccept, toolTitle } = {} as any

// @TODO: how to handle schema/id changes?
const config: VendorConfiguration = {
  id: 'firebase-files',
  customDataFieldName: 'firebase',
  defaultAccept,
  toolTitle: toolTitle ?? 'Videos & Audio (Firebase)',
  supportsProgress: true,
  credentialsFields: [
    {
      name: 'apiKey',
      title: 'API Key',
      icon: LockIcon,
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'storageBucket',
      title: 'Storage Bucket',
      icon: LinkIcon,
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
  ],
  deleteFile: async ({ storedFile, credentials }) => {
    try {
      const firebaseClient = getFirebaseClient(
        credentials as FirebaseCredentials,
      )

      await firebaseClient
        .storage()
        .ref(storedFile.firebase?.fullPath)
        .delete()

      return true
    } catch (error: any) {
      if (error?.code === 'storage/object-not-found') {
        // If file not found in Firebase, we're good!
        return true
      }

      return 'Error'
    }
  },
  uploadFile: ({
    credentials,
    onError,
    onSuccess,
    file,
    fileName,
    updateProgress,
  }) => {
    const firebaseClient = getFirebaseClient(credentials as FirebaseCredentials)
    const ref = firebaseClient.storage().ref(fileName)
    const uploadTask = ref.put(file, {
      customMetadata: {
        uploadedFrom: 'sanity-plugin-firebase-files',
      },
    })

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.ceil(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        )

        updateProgress(progress)
      },
      (error) => {
        onError(error)
      },
      async () => {
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL()
        const metadata = await uploadTask.snapshot.ref.getMetadata()

        onSuccess({
          fileURL: downloadURL,
          firebase: {
            bucket: metadata.bucket,
            contentDisposition: metadata.contentDisposition,
            contentEncoding: metadata.contentEncoding,
            fullPath: metadata.fullPath,
            md5Hash: metadata.md5Hash,
            generation: metadata.generation,
            metageneration: metadata.metageneration,
            type: metadata.type,
          },
        })
      },
    )
    return () => {
      try {
        uploadTask.cancel()
      } catch (error) {}
    }
  },
}

export default config
