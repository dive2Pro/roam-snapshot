## Table of Contents
- [Table of Contents](#table-of-contents)
- [Page History](#page-history)
  - [Access page history](#access-page-history)
  - [Restore past page history snapshots](#restore-past-page-history-snapshots)
- [Block Timeline](#block-timeline)
- [Changelog](#changelog)
  - [v3](#v3)
  - [v2](#v2)

## Page History
The `Page history` feature lets you see all changes made to a page, when. You can view and restore past versions of any Roam page going back indefinitely.


### Access page history

- Click the ••• menu at the top right of any Roam page. Choose Page history.

<img width="500" alt="image" src="https://user-images.githubusercontent.com/23192045/212555750-0537af6b-1045-4b37-a5b6-37a990dea46e.png">


- This opens the Page history window, which enables you to:
  - See all past versions of the current page in a list down the right-hand side. (Every change made to a page creates a separate snapshot.)
  - Click on any past version to see what the page looked like at that point in time and difference with its prev version.

Note: Here's how page history functions!


If you are **actively editing** a page, a snapshot of the current version of the page will be captured every **ten minutes** (You can change it in settings panel).

### Restore past page history snapshots

- You can restore an entire past version so it becomes your current version of the page.


![embed mode](https://user-images.githubusercontent.com/23192045/212555992-d058c221-a59c-4774-9cf4-a62f8b064a6a.gif)



## Block Timeline

Now, every block created generates a complete snapshot over time to ensure that the block's data is not lost due to various unexpected circumstances. You can right click the dot icon in front of a block and select "Extensions -> History: Block Timeline" from the block menu to view the entire lifecycle changes of any block and restore it to any previous version.


https://github.com/user-attachments/assets/850662a6-bee7-435e-8793-ac1966d9bc75


By playing back the block history, you can view the entire lifecycle changes of a block. The information and its transformation process will never be lost again.



https://github.com/user-attachments/assets/ff96af0a-a040-4818-9a5c-99eeaa8b8c62

When there are too many historical versions of a block, scroll through the timeline to view all version timestamps.

https://github.com/user-attachments/assets/91854fa7-3758-42cc-882a-2b26dd1789b3

Click the button on the player to quickly jump to view the earliest historical version or the latest current version.


https://github.com/user-attachments/assets/3e4311bc-e6a9-41fc-bd95-3d4d2ee0915b

Restoring a block version is equivalent to editing that block, and this edit record will also appear in your page's edit history, ensuring effective secondary protection of your information and data.




## Changelog

### v3

- Rename to Roam History
- Remove sync data feature. All data is now saved locally
- Add block timeline feature

### v2

- Now, the cache is saved locally first, which makes the saving and viewing process more efficient. All history data is saved into one file, and the file URL is stored in [[roam/plugin/page history]] as the first child block.
- Local cache will be automatically uploaded to Roam Service every 60 minutes after the first local cache is created (you can also change the interval time in the settings). You can click the button in the bottom right corner of the screen to upload immediately.
