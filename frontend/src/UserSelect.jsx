import React from 'react'

const UserSelect = ({ users, selectedUsers, setSelectedUsers}) => {

  const handleSelectChange = (event) => {
    // Get all the options from the select element
    const options = event.target.options;
    const newSelectedUsers = [];

    // Loop through all options to find which ones are selected
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        newSelectedUsers.push(options[i].value);
      }
    }
    // Update the state with the new array of selected user names
    setSelectedUsers(newSelectedUsers);
  };
  return (
     <select
     multiple={true}
     value={selectedUsers}
     onChange={handleSelectChange}
     //className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
    // style={{ minHeight: '150px' }} // Give it a fixed height to show multiple options

     >
      {users.map((user, index) => (
        <option
          key={index}
          value={user.data.displayName}
          // The 'selected' attribute is not strictly necessary here because 'value' handles it,
          // but it can be useful for initial rendering in some cases.
        >
          {user.data.displayName}
        </option>
      ))}
  </select>

  )
}

export default UserSelect